type TokenType = "PREFIX" | "COMMAND_WORD" | "MODIFIER" | "SUFFIX" | "PARAM";

interface Token {
  key: string;
  type: TokenType;
  basePower: number;
  semanticTags: string[];
  author: string;
}

interface Command {
  tokens: Token[];
  basePower: number;
  contributors: Map<string, number>;
  tags: Set<string>;
}

// =====================
// FSM правила: для каждого состояния и типа токена — массив возможных nextState
// =====================
const TokenFSMMap: Record<TokenType, TokenType[]> = {
  PREFIX: ["PREFIX", "COMMAND_WORD"],        // после префикса можно ещё префикс или команду
  COMMAND_WORD: ["PREFIX", "COMMAND_WORD", "PARAM"], // после команды могут быть префикс, команда или параметр
  PARAM: ["MODIFIER"],                      // после параметра идёт модификатор
  MODIFIER: ["SUFFIX"],                     // после модификатора идёт суффикс
  SUFFIX: []                                // завершающее состояние
};

function generateRandomCommandOptimized(allTokens: Token[]): Command | null {
  if (!allTokens.length) return null;

  // Группируем токены по типу для быстрого доступа
  const tokensByType: Record<TokenType, Token[]> = {
    PREFIX: [],
    COMMAND_WORD: [],
    PARAM: [],
    MODIFIER: [],
    SUFFIX: []
  };
  allTokens.forEach(t => tokensByType[t.type].push(t));

  const commandTokens: Token[] = [];
  const contributors = new Map<string, number>();
  const tags = new Set<string>();

  // Стартуем с первого типа в FSM
  const fsmKeys = Object.keys(TokenFSMMap) as TokenType[];
  let currentType: TokenType = fsmKeys[0];

  while (true) {
    const availableTokens = tokensByType[currentType];
    if (!availableTokens || !availableTokens.length) return null;

    // Берём случайный токен текущего типа
    const token = availableTokens[Math.floor(Math.random() * availableTokens.length)];
    commandTokens.push(token);

    // Обновляем contributors и tags
    contributors.set(token.author, (contributors.get(token.author) || 0) + token.basePower);
    token.semanticTags.forEach(tag => tags.add(tag));

    // Определяем допустимые переходы
    const nextTypes = TokenFSMMap[token.type];
    if (!nextTypes || !nextTypes.length) break; // дошли до SUFFIX

    // Подсчитываем общее количество токенов в массивах всех переходов
    let totalTokens = 0;
    const tokenRanges: { type: TokenType; start: number; end: number }[] = [];
    for (const t of nextTypes) {
      const pool = tokensByType[t];
      if (pool && pool.length) {
        tokenRanges.push({ type: t, start: totalTokens, end: totalTokens + pool.length - 1 });
        totalTokens += pool.length;
      }
    }

    if (totalTokens === 0) return null; // нет токенов для перехода — ждём перезапуска

    // Выбираем случайный индекс в "виртуальном объединённом массиве"
    const randIndex = Math.floor(Math.random() * totalTokens);

    // Находим, к какому типу принадлежит этот индекс
    let nextToken: Token | null = null;
    for (const range of tokenRanges) {
      if (randIndex >= range.start && randIndex <= range.end) {
        const pool = tokensByType[range.type];
        nextToken = pool[randIndex - range.start];
        break;
      }
    }

    if (!nextToken) return null; // защитная проверка

    currentType = nextToken.type;
  }

  const basePower = commandTokens.reduce((sum, t) => sum + t.basePower, 0);

  return {
    tokens: commandTokens,
    basePower,
    contributors,
    tags
  };
}