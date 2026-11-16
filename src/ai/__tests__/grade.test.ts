import { gradeAnswer } from '../grade';
const config = { baseUrl: 'https://ai.example/v1', model: 'test', apiKey: '' };
const response = (data: unknown) => jest.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(data) } }] }))) as jest.MockedFunction<typeof fetch>;
it('принимает оценку и объяснение, передаёт три текста как данные', async () => {
  const fetch = response({ grade: 4, feedback: 'Уточни условие.' });
  await expect(gradeAnswer(config, 'Вопрос', 'Эталон', 'Мой ответ', fetch)).resolves.toEqual({ grade: 4, feedback: 'Уточни условие.' });
  const body = JSON.parse(String(fetch.mock.calls[0][1]?.body));
  expect(JSON.parse(body.messages[1].content)).toEqual({ question: 'Вопрос', reference: 'Эталон', answer: 'Мой ответ' });
});
it('принимает ноль за полностью неверный ответ', async () => {
  const evaluation = { grade: 0, feedback: 'Ответ не по теме.' };
  await expect(gradeAnswer(config, 'q', 'r', 'a', response(evaluation))).resolves.toEqual(evaluation);
});

it.each([-1, 6, 3.5, '5', null])('не принимает некорректную оценку %s', async grade => {
  await expect(gradeAnswer(config, 'q', 'r', 'a', response({ grade, feedback: 'ok' }))).rejects.toThrow(/оценку/);
});
it('не оценивает пустой ответ и не принимает пустое объяснение', async () => {
  const fetch = response({ grade: 5, feedback: '' });
  await expect(gradeAnswer(config, 'q', 'r', ' ', fetch)).rejects.toThrow(/Сначала/);
  expect(fetch).not.toHaveBeenCalled();
  await expect(gradeAnswer(config, 'q', 'r', 'a', fetch)).rejects.toThrow(/оценку/);
});
