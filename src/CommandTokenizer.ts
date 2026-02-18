import { TokenType, Token } from './Types';


// Реестр валидных токенов (по сути твоя база знаний)
export class TokenRegistry {
  private static registry: Map<string, Token> = new Map([
    ["!fire", {
      key: "!fire",
      type: TokenType.Action,
      basePower: 50,
      semanticTags: ["damage", "elemental"],
      author: "system"
    }],
    ["!heal", {
      key: "!heal",
      type: TokenType.Action,
      basePower: 30,
      semanticTags: ["restore", "support"],
      author: "system"
    }],
    ["@boss", {
      key: "@boss",
      type: TokenType.Target,
      basePower: 0,
      semanticTags: ["enemy", "raid"],
      author: "system"
    }],
    ["+crit", {
      key: "+crit",
      type: TokenType.Modifier,
      basePower: 20,
      semanticTags: ["multiplier"],
      author: "system"
    }]
  ]);

  static getToken(key: string): Token | null {
    return this.registry.get(key) ?? null;
  }
}

// Лексер / Парсер
export class Tokenizer {

  public static parse(input: string, author: string): Token[] {
    const parsedTokens: Token[] = [];

    const rawParts = input.trim().split(/\s+/);

    for (const part of rawParts) {
      const tokenTemplate = TokenRegistry.getToken(part);

      if (tokenTemplate) {
        parsedTokens.push({
          ...tokenTemplate,
          author
        });
      }
    }

    return parsedTokens;
  }
}