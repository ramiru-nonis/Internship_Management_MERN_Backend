const OpenAI = require('openai');

exports.enhanceLogbook = async (req, res) => {
    try {
        const { text, context } = req.body;

        if (!text || text.length < 5) {
            return res.status(400).json({ message: "Please provide more details." });
        }

        // Mock Response if no API Key
        if (!process.env.OPENAI_API_KEY) {
            console.warn("Missing OPENAI_API_KEY. Returning mock response.");

            // Simulating AI delay
            await new Promise(resolve => setTimeout(resolve, 1500));

            return res.status(200).json({
                activities: `[AI Enhanced] Professional Summary:
• ${text.replace(/\./g, '.\n• ')}
• Demonstrated initiative in identifying and resolving technical challenges.
• Collaborated with team members to ensure project milestones were met.`,
                techSkills: "Project Management, Problem Solving, Communication (Inferred)",
                softSkills: "Time Management, Teamwork, Adaptability"
            });
        }

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const systemPrompt = `You are a professional technical writer. Your task is to transform a student's casual logbook entry into a professional internship report. 
        Output JSON with keys: "activities" (bullet points, active voice), "techSkills" (comma separated), "softSkills" (comma separated).`;

        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Context: ${context || 'General Internship'}. Entry: "${text}"` }
            ],
            model: "gpt-3.5-turbo",
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0].message.content);

        res.status(200).json(result);

    } catch (error) {
        console.error("AI Enhance Error:", error);
        res.status(500).json({ message: "AI Enhancement failed. Please try again." });
    }
};
