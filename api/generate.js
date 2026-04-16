// api/generate.js - Niam ! Backend Serverless Function
// Vercel handles this with Node.js 18+ environment (supports global fetch)

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Méthode non autorisée. Utilisez POST.' });
    }

    try {
        const { ingredientsText, pTime, allDiets, difficulty, isBudget, eqp } = req.body;

        if (!ingredientsText) {
            return res.status(400).json({ error: 'Les ingrédients sont obligatoires.' });
        }

        const API_KEY = process.env.GEMINI_API_KEY;

        if (!API_KEY) {
            console.error("Missing GEMINI_API_KEY in environment variables.");
            return res.status(500).json({ error: "Configuration serveur incomplète (Clé API manquante)." });
        }

        const prompt = `Tu es un chef cuisinier expert en anti-gaspillage. Voici les ingrédients disponibles : ${ingredientsText}. Contraintes : Temps max ${pTime} min, Régimes: ${allDiets.join(', ')}, Difficulté: ${difficulty}, Budget: ${isBudget ? 'Petit budget' : 'Peu importe'}. Équipements: ${eqp.join(', ')}. Génère une recette créative et délicieuse.
        Tu DOIS répondre UNIQUEMENT au format JSON valide avec cette structure exacte :
        {
          "titre": "Nom du plat",
          "temps": "${pTime} min",
          "calories": "xxx kcal",
          "etapes": ["Etape 1...", "Etape 2..."],
          "courses_manquantes": ["ingrédient 1", "ingrédient 2"]
        }`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Gemini API Error:", errorBody);
            throw new Error("Erreur lors de la communication avec l'IA Google.");
        }

        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error("Format de réponse de l'IA invalide.");
        }

        const rawText = data.candidates[0].content.parts[0].text;
        
        // JSON Cleaning (Markdown removal)
        const cleanJsonText = rawText.replace(/```json|```/gi, "").trim();
        
        try {
            const recipeData = JSON.parse(cleanJsonText);
            return res.status(200).json(recipeData);
        } catch (parseErr) {
            console.error("JSON Parse Error:", cleanJsonText);
            throw new Error("L'IA a généré une réponse mal formatée.");
        }

    } catch (err) {
        console.error("Serverless Function Error:", err.message);
        return res.status(500).json({ error: err.message || "Une erreur interne est survenue." });
    }
}
