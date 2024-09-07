export const systemPrompt = `
PROMPT GOES  HERE

`

export const prompt = (findings: any, query: string) => {
    const basePrompt = `
${query}
`
    return systemPrompt + basePrompt;
}