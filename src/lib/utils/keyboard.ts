export const charSets: Record<string, string[]> = {
	fr: ['à', 'â', 'æ', 'ç', 'é', 'è', 'ê', 'ë', 'î', 'ï', 'ô', 'œ', 'ù', 'û', 'ü', 'ÿ'],
	french: ['à', 'â', 'æ', 'ç', 'é', 'è', 'ê', 'ë', 'î', 'ï', 'ô', 'œ', 'ù', 'û', 'ü', 'ÿ'],
	es: ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ', '¿', '¡'],
	spanish: ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ', '¿', '¡'],
	de: ['ä', 'ö', 'ü', 'ß'],
	german: ['ä', 'ö', 'ü', 'ß']
};

export function requiresSpecialKeyboard(expectedAnswer: string, language: string): boolean {
	const normalizedLang = language?.toLowerCase() || 'en';
	const activeChars = charSets[normalizedLang] || [];
	
	if (activeChars.length === 0) return false;
	
	const lowerAnswer = expectedAnswer.toLowerCase();
	return activeChars.some((char) => lowerAnswer.indexOf(char) !== -1);
}
