import { AiError, chat, cleanReply, parseJsonReply } from '../client';
import { readAiConfig, type AiConfig } from '../config';
import { recognizeText } from '../recognize';

const config: AiConfig = { baseUrl: 'https://ai.example/v1', model: 'qwen-test', apiKey: 'secret' };

const reply = (content: string, status = 200) =>
  (async () =>
    new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status })) as typeof fetch;

describe('readAiConfig', () => {
  it('нужны адрес и модель, ключ — по желанию; хвостовой слэш убирается', () => {
    expect(readAiConfig({})).toBeNull();
    expect(readAiConfig({ EXPO_PUBLIC_AI_BASE_URL: 'https://x/v1' })).toBeNull();
    expect(
      readAiConfig({ EXPO_PUBLIC_AI_BASE_URL: ' https://x/v1/ ', EXPO_PUBLIC_AI_MODEL: 'm' }),
    ).toEqual({ baseUrl: 'https://x/v1', model: 'm', apiKey: '' });
  });
});

describe('chat', () => {
  it('шлёт OpenAI-совместимый запрос с ключом и возвращает текст', async () => {
    let request: { url: string; init: RequestInit } | undefined;
    const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
      request = { url: String(url), init: init! };
      return new Response(JSON.stringify({ choices: [{ message: { content: 'привет' } }] }));
    }) as typeof fetch;

    await expect(chat(config, [{ role: 'user', content: 'hi' }], fetchImpl)).resolves.toBe('привет');
    expect(request?.url).toBe('https://ai.example/v1/chat/completions');
    expect((request?.init.headers as Record<string, string>).Authorization).toBe('Bearer secret');
    expect(JSON.parse(String(request?.init.body))).toMatchObject({
      model: 'qwen-test',
      temperature: 0,
      messages: [{ role: 'user', content: 'hi' }],
    });
  });

  it('без ключа не шлёт заголовок авторизации', async () => {
    let headers: Record<string, string> = {};
    const fetchImpl = (async (_: RequestInfo | URL, init?: RequestInit) => {
      headers = init!.headers as Record<string, string>;
      return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }));
    }) as typeof fetch;
    await chat({ ...config, apiKey: '' }, [], fetchImpl);
    expect(headers.Authorization).toBeUndefined();
  });

  it.each([
    [401, '', /ключ/],
    [404, '', /не найдена/],
    [429, '', /много запросов/],
    [400, '{"error":"model does not support image input"}', /не умеет читать изображения/],
    [500, '', /ошибкой 500/],
  ])('переводит ошибку %i в понятный текст', async (status, body, message) => {
    const fetchImpl = (async () => new Response(body, { status })) as typeof fetch;
    await expect(chat(config, [], fetchImpl)).rejects.toThrow(message);
  });

  it('сообщает об обрыве связи и о таймауте', async () => {
    const offline = (async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch;
    await expect(chat(config, [], offline)).rejects.toThrow(/Нет связи/);

    const hanging = ((_: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_, reject) =>
        init!.signal!.addEventListener('abort', () => reject(new Error('aborted'))),
      )) as typeof fetch;
    await expect(chat(config, [], hanging, { timeoutMs: 10 })).rejects.toThrow(/не ответила/);
  });

  it('пустой ответ — ошибка', async () => {
    const fetchImpl = (async () => new Response('{"choices":[]}')) as typeof fetch;
    await expect(chat(config, [], fetchImpl)).rejects.toBeInstanceOf(AiError);
  });
});

describe('разбор ответа', () => {
  it('убирает рассуждения и обёртку кода', () => {
    expect(cleanReply('<think>хм</think>\n```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('находит JSON среди текста и отклоняет мусор', () => {
    expect(parseJsonReply('Вот ответ: {"lines":["a"]} Готово.')).toEqual({ lines: ['a'] });
    expect(() => parseJsonReply('не знаю')).toThrow(/формате/);
    expect(() => parseJsonReply('{broken')).toThrow(/формате/);
  });
});

describe('recognizeText', () => {
  it('шлёт фото и язык, возвращает очищенные строки', async () => {
    let body: { messages: { content: { type: string; text?: string; image_url?: { url: string } }[] }[] } | undefined;
    const fetchImpl = (async (_: RequestInfo | URL, init?: RequestInit) => {
      body = JSON.parse(String(init!.body));
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"lines": ["  Рибосома —  органоид ", "", 42, "клетки"]}' } }],
        }),
      );
    }) as typeof fetch;

    await expect(recognizeText(config, 'QUJD', 'ru-RU', fetchImpl)).resolves.toEqual([
      'Рибосома — органоид',
      'клетки',
    ]);
    const parts = body!.messages[0].content;
    expect(parts[0].image_url?.url).toBe('data:image/jpeg;base64,QUJD');
    expect(parts[1].text).toContain('русский');
  });

  it('отклоняет ответ без списка строк', async () => {
    await expect(recognizeText(config, 'x', 'en-US', reply('{"text":"hi"}'))).rejects.toThrow(/формате/);
  });
});
