import type { AiConfig } from '../config';
import { generateBack, PRESETS } from '../generate';

const config: AiConfig = { baseUrl: 'https://ai.example/v1', model: 'm', apiKey: 'k' };

function fakeModel(content: string) {
  const requests: { messages: { role: string; content: string }[] }[] = [];
  const fetchImpl = (async (_: RequestInfo | URL, init?: RequestInit) => {
    requests.push(JSON.parse(String(init!.body)));
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }));
  }) as typeof fetch;
  return { requests, fetchImpl };
}

const input = {
  front: ' photosynthesis ',
  deckName: 'Биология',
  backLanguage: 'ru-RU',
  instruction: 'Определение для 7 класса',
};

describe('generateBack', () => {
  it('передаёт термин, предмет, язык и инструкцию', async () => {
    const model = fakeModel('Фотосинтез — образование органических веществ на свету.');
    await expect(generateBack(config, input, model.fetchImpl)).resolves.toBe(
      'Фотосинтез — образование органических веществ на свету.',
    );
    const user = model.requests[0].messages[1].content;
    expect(user).toContain('Биология');
    expect(user).toContain('«photosynthesis»');
    expect(user).toContain('русский');
    expect(user).toContain('Определение для 7 класса');
  });

  it('другой вариант просит менее предсказуемый ответ', async () => {
    const model = fakeModel('бабочка');
    await generateBack(config, input, model.fetchImpl);
    await generateBack(config, { ...input, variation: true }, model.fetchImpl);
    expect(model.requests.map((r) => (r as unknown as { temperature: number }).temperature)).toEqual([0, 0.8]);
  });

  it('без инструкции просит перевод', async () => {
    const model = fakeModel('бабочка');
    await generateBack(config, { ...input, instruction: '  ' }, model.fetchImpl);
    expect(model.requests[0].messages[1].content).toContain(PRESETS[0].instruction);
  });

  it('убирает рассуждения, markdown и кавычки вокруг ответа', async () => {
    const model = fakeModel('<think>думаю</think>\n## Ответ\n«**Бабочка** — насекомое»');
    await expect(generateBack(config, input, model.fetchImpl)).resolves.toBe(
      'Ответ\n«Бабочка — насекомое»',
    );
    const quoted = fakeModel('"бабочка"');
    await expect(generateBack(config, input, quoted.fetchImpl)).resolves.toBe('бабочка');
  });

  it('обрезает слишком длинный ответ под размер поля', async () => {
    const model = fakeModel('а'.repeat(1500));
    const text = await generateBack(config, input, model.fetchImpl);
    expect(text).toHaveLength(1000);
    expect(text.endsWith('…')).toBe(true);
  });

  it('не ходит в модель без слова и сообщает о пустом ответе', async () => {
    const model = fakeModel('x');
    await expect(generateBack(config, { ...input, front: ' ' }, model.fetchImpl)).rejects.toThrow(
      /заполни сторону со словом/,
    );
    expect(model.requests).toHaveLength(0);
    await expect(generateBack(config, input, fakeModel('<think>…</think>').fetchImpl)).rejects.toThrow(
      /пустой/,
    );
  });
});
