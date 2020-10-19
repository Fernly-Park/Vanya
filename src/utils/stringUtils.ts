/* eslint-disable @typescript-eslint/no-explicit-any */

export const isAString = (string: any): boolean => {
    return typeof string === 'string';
};

export const isAnEmptyString = (string: any): boolean => {
    return typeof string === 'string' && string.length === 0;
}

export const containsWhiteSpace = (string: string): boolean => {
    return /\s/.test(string);
};

export const trimAll = (s: string[]): string[] => {
    const toReturn: string[] = [];
    s.forEach(currentString => {
        toReturn.push(currentString.trim());
    });

    return toReturn;
}

const simpleRegexFactory = (wildCard: string, escape: string) => {
    const match = (str: string, rule: string) => {
        let interpretNextCharacter = true;
        let currentIndexInStr = 0;
        for (let r = 0; r < rule.length; r++) {
            if (interpretNextCharacter && rule[r] === escape) {
                interpretNextCharacter = false;
                continue;
            }
            if (interpretNextCharacter && rule[r] === wildCard) {
                const isLastCharacterInRegec = r === rule.length - 1;
                if (isLastCharacterInRegec) {
                    return true;
                }
                let indexPossibleFollowingChar = (rule[r+1] !== escape && rule[r+1] !== wildCard) ? str.indexOf(rule[r+1], currentIndexInStr) : currentIndexInStr
                while (indexPossibleFollowingChar !== -1) {
                    if (match(str.substr(indexPossibleFollowingChar), rule.substr(r+1))) {
                        return true;
                    }
                    currentIndexInStr = indexPossibleFollowingChar+1
                    indexPossibleFollowingChar = str.indexOf(rule[r+1], currentIndexInStr)
                }
                return false;
            }

            if (!interpretNextCharacter && rule[r] != escape && rule[r] != wildCard) {
                throw new Error(`All occurrences of ${escape} and ${wildCard} literal, must be escaped with ${escape} within the StringMatches pattern.`);
            }
            
            if (rule[r] !== str[currentIndexInStr++]) {
                return false;
            } 

            interpretNextCharacter = true;
        }

        if (!interpretNextCharacter) {
            throw new Error(`All occurrences of ${escape} and ${wildCard} literal, must be escaped with ${escape} within the StringMatches pattern.`);
        }
        return true;
    }

    return match;
}
export const stringMatches = simpleRegexFactory("*", "\\");