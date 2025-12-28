const OpenAI = require('openai');

exports.enhanceLogbook = async (req, res) => {
    try {
        const { text, context, style } = req.body;

        if (!text || text.length < 5) {
            return res.status(400).json({ message: "Please provide more details." });
        }

        // --- MOCK MODE (No API Key) ---
        if (!process.env.OPENAI_API_KEY) {
            console.warn("Missing OPENAI_API_KEY. Returning DYNAMIC mock response.");

            // Simulating AI delay
            await new Promise(resolve => setTimeout(resolve, 800)); // Slightly faster

            // Randomizers for Variety
            const verbs = ["Spearheaded", "Orchestrated", "Executed", "Implemented", "Designed", "Optimized", "Refined", "Collaborated on", "Managed"];
            const adverbs = ["successfully", "effectively", "efficiently", "proactively", "strategically", "meticulously"];
            const impacts = ["enhancing system performance", "improving user experience", "reducing latency", "aligning with business goals", "ensuring code quality"];

            const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

            // Dynamic Generation
            const enhancedText = text.replace(/\./g, '').split(' ')
                .filter(w => w.length > 3)
                .slice(0, 3)
                .join(' '); // Grab some keywords from input

            // Generate 3 unique bullet points
            const bullets = [
                `${pick(verbs)} the development of ${enhancedText || 'core features'}, ${pick(adverbs)} ${pick(impacts)}.`,
                `${pick(verbs)} technical documentation and ${pick(adverbs)} utilized industry standards to ensure scalability.`,
                `Demonstrated professional growth by ${pick(verbs).toLowerCase()} complex tasks within the ${context || 'project scope'}.`
            ];

            const stylePrefix = style ? `[${style} Style]\n` : "";

            return res.status(200).json({
                activities: `${stylePrefix}• ${bullets[0]} \n• ${bullets[1]} \n• ${bullets[2]} `,
                techSkills: "React.js, Node.js, System Architecture, Debugging",
                softSkills: "Critical Thinking, Adaptability, Cross-functional Collaboration"
            });
        }

        // --- REAL AI MODE ---
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const selectedStyle = style || "Professional";
        const systemPrompt = `You are an expert technical writer.Transform the student's logbook entry into a ${selectedStyle} report.
        Style Guide:
- Professional: Balanced, standard industry tone.
        - Executive: High - level, focus on impact and business value.
        - Technical: Detailed, focus on implementation and specific technologies.
        - Creative: Engaging, slightly more narrative but professional.
        
        Output JSON: { "activities"(bullet points), "techSkills", "softSkills" }.`;

        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Context: ${context}.Entry: "${text}"` }
            ],
            model: "gpt-3.5-turbo",
            temperature: 0.7, // Higher creativity
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0].message.content);

        res.status(200).json(result);

    } catch (error) {
        console.error("AI Enhance Error:", error);
        res.status(500).json({ message: "AI Enhancement failed. Please try again." });
    }
};
