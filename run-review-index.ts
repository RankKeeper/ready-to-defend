// Supabase Edge Function: run-review
// Proxies Anthropic API calls for the Ready To Defend review engine
// Keeps the API key secure in Supabase secrets, never exposed in browser

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-5'

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY secret not set')

    const body = await req.json()
    const { prompt, passId } = body
    if (!prompt) throw new Error('Missing prompt')

    const systemPrompt = `You are the Ready To Defend dissertation review engine, built on the proprietary methodology of Dr. Jennifer Touati, EdD.

Your ONLY output must be a raw JSON array. No markdown, no code fences, no preamble, no explanation. Begin your response with [ and end with ].

Each finding object in the array:
{
  "chapter": "Chapter 1",
  "section": "Background of the Problem",
  "module": "anthropomorphic",
  "moduleName": "Anthropomorphic Statements",
  "severity": "critical|major|moderate|minor|coaching",
  "passage": "REQUIRED -- copy the exact sentence or phrase from the dissertation that triggered this flag. Up to 60 words. If the issue is document-wide (e.g. no title page), write: [Document-wide issue -- no specific passage]",
  "issue": "What is wrong and what rule applies. 2-3 sentences.",
  "coaching": "Dr. Touati coaching comment in her voice. WHY it matters for defense. What to do. Vary the delivery."
}

SEVERITY:
- critical: must fix before defense; committee sends it back
- major: significant weakness undermining the research
- moderate: needs attention; will get flagged but not a fail
- minor: polish item; will not stop the defense
- coaching: Dr. Touati observation, not an error

Return [] if no issues found for the modules being checked.`

    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Anthropic API error ${response.status}: ${errText.substring(0, 300)}`)
    }

    const data = await response.json()
    console.log(`run-review [${passId}]: HTTP ${response.status}, content length: ${JSON.stringify(data).length}`)

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    })

  } catch (err: any) {
    console.error('run-review error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    })
  }
})
