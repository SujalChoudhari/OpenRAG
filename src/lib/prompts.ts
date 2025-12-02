export const systemPrompt = (sources: string) => {
    const base = `
Summarize from the following context and answer the users question in neat and concise manner.
<context>
${sources}
</context>

`
    return base;
}