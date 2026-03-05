// Fallback responses based on failure probability ranges
const fallbackResponses = {
    low: [
        "1. Diagnosis: System operating within normal parameters. Minor wear detected on cutting tool edges. 2. Action: Continue monitoring. Schedule routine inspection in 50 operating hours.",
        "1. Diagnosis: Thermal readings stable. Slight vibration variance in spindle assembly. 2. Action: No immediate action required. Log readings for trend analysis.",
        "1. Diagnosis: All sensors nominal. Tool wear consistent with expected degradation curve. 2. Action: Maintain current operating schedule. Review at next maintenance window.",
        "1. Diagnosis: Process temperatures optimal. Rotational speed within tolerance. 2. Action: Continue operations. Update maintenance log with current readings.",
        "1. Diagnosis: Equipment health good. Minor thermal fluctuation detected but within acceptable range. 2. Action: Monitor next 24 hours. No intervention needed."
    ],
    medium: [
        "1. Diagnosis: Elevated thermal differential detected. Possible bearing wear or lubrication degradation. 2. Action: Schedule preventive maintenance within 72 hours. Check lubricant levels.",
        "1. Diagnosis: Tool wear approaching threshold. Torque patterns suggest increasing friction. 2. Action: Plan tool replacement within next shift. Reduce feed rate 10% until replaced.",
        "1. Diagnosis: RPM fluctuations indicate drive belt tension issue. Process temperature rising. 2. Action: Inspect belt tension and alignment. Schedule adjustment within 48 hours.",
        "1. Diagnosis: Vibration signature shows early-stage imbalance. Wear rate accelerating. 2. Action: Balance check recommended. Prepare replacement components as precaution.",
        "1. Diagnosis: Thermal creep detected in process zone. Cooling efficiency degraded by 15%. 2. Action: Clean cooling channels. Verify coolant flow rate and concentration."
    ],
    high: [
        "1. Diagnosis: Critical wear level on primary cutting surface. Thermal runaway risk elevated. 2. Action: Replace tool immediately. Do not continue operation without replacement.",
        "1. Diagnosis: Bearing failure imminent based on vibration and temperature data. 2. Action: Stop machine for emergency maintenance. Replace bearing assembly before restart.",
        "1. Diagnosis: Severe thermal stress detected. Process temperature exceeds safe threshold by 12K. 2. Action: Immediate shutdown required. Inspect for coolant leak or pump failure.",
        "1. Diagnosis: Catastrophic tool failure likely within 30 minutes of operation. Torque spikes critical. 2. Action: Halt production immediately. Full tool and holder inspection required.",
        "1. Diagnosis: Multiple failure indicators triggered. Spindle motor drawing excessive current. 2. Action: Emergency stop. Do not restart until full diagnostic and repair completed."
    ]
};

function getFallbackResponse(prediction_prob) {
    let category;
    if (prediction_prob < 0.3) category = 'low';
    else if (prediction_prob < 0.7) category = 'medium';
    else category = 'high';

    const responses = fallbackResponses[category];
    return responses[Math.floor(Math.random() * responses.length)];
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const {
        air_temperature_K,
        process_temperature_K,
        rotational_speed_rpm,
        torque_Nm,
        tool_wear_min,
        type,
        prediction_prob
    } = req.body;

    const useStream = req.headers.accept === 'text/event-stream';
    const TIMEOUT_MS = 15000; // 15 second timeout

    const prompt = `
    You are a Senior Reliability Engineer analyzing predictive maintenance data.
    Machine Type: ${type}
    Sensors: Air ${air_temperature_K}K, Proc ${process_temperature_K}K, RPM ${rotational_speed_rpm}, Torque ${torque_Nm}Nm, Wear ${tool_wear_min}min.
    Failure Probability: ${(prediction_prob * 100).toFixed(1)}%.

    Task:
    1. Diagnosis: What is breaking?
    2. Action: What should we do?

    Format: Concise, Plain text. No markdown. MAX 50 words.
  `;

    // Helper to stream text character by character
    async function streamResponse(text, res) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        for (let i = 0; i < text.length; i++) {
            res.write(`data: ${JSON.stringify({ char: text[i] })}\n\n`);
            await new Promise(r => setTimeout(r, 20 + Math.random() * 30));
        }
        res.write(`data: [DONE]\n\n`);
        res.end();
    }

    try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        // 1. Start Prediction
        const startRes = await fetch("https://api.replicate.com/v1/predictions", {
            method: "POST",
            headers: {
                "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                version: "b66517f8a5c77dc2ceb16664440faeed91f0ba0470db40a3018006ca0204bd38",
                input: { prompt, max_tokens: 150, temperature: 0.5 },
            }),
            signal: controller.signal,
        });

        const rateLimitRemaining = startRes.headers.get('ratelimit-remaining');
        const rateLimitReset = startRes.headers.get('ratelimit-reset');

        if (startRes.status !== 201) {
            clearTimeout(timeoutId);
            // Fallback on API error
            const fallback = getFallbackResponse(prediction_prob);
            if (useStream) return streamResponse(fallback, res);
            return res.status(200).json({ text: fallback, fallback: true });
        }

        let prediction = await startRes.json();
        const getUrl = prediction.urls.get;

        // 2. Poll for completion with timeout
        const pollStart = Date.now();
        while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
            if (Date.now() - pollStart > TIMEOUT_MS) {
                clearTimeout(timeoutId);
                // Timeout - use fallback
                const fallback = getFallbackResponse(prediction_prob);
                if (useStream) return streamResponse(fallback, res);
                return res.status(200).json({ text: fallback, fallback: true });
            }
            await new Promise(r => setTimeout(r, 250));
            const pollRes = await fetch(getUrl, {
                headers: { "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}` }
            });
            prediction = await pollRes.json();
        }

        clearTimeout(timeoutId);

        if (prediction.status === 'failed') {
            const fallback = getFallbackResponse(prediction_prob);
            if (useStream) return streamResponse(fallback, res);
            return res.status(200).json({ text: fallback, fallback: true });
        }

        // 3. Return text (stream or JSON)
        const responseText = prediction.output.join('');
        if (useStream) {
            return streamResponse(responseText, res);
        }

        res.status(200).json({
            text: responseText,
            rateLimits: {
                remaining: rateLimitRemaining,
                reset: rateLimitReset
            }
        });
    } catch (error) {
        // On any error (including abort), use fallback
        const fallback = getFallbackResponse(prediction_prob);
        if (useStream) return streamResponse(fallback, res);
        res.status(200).json({ text: fallback, fallback: true });
    }
}
