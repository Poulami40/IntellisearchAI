
const mongoose = require("mongoose");
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const ForumPost = require("./models/ForumPost"); // Import ForumPost model


require("dotenv").config();


const app = express();
app.use(cors({
    origin: 'https://intellisearch-ai-poulami40s-projects.vercel.app',
    credentials: true
  }));
  
app.use(express.json());

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";

// Connect to MongoDB
mongoose.connect("mongodb+srv://Intellisearch:test123@intellisearch.jpo2q.mongodb.net/?retryWrites=true&w=majority&appName=Intellisearch", {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("MongoDB Connected"))
.catch(err => console.error("MongoDB Connection Error:", err));

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    searchHistory: { type: [String], default: [] },
    searchCount: { type: Number, default: 0 },
    quizCount: { type: Number, default: 0 },
    otp: { type: String },  // Store OTP
    otpExpires: { type: Date } // OTP expiration
});

const User = mongoose.model("User", userSchema);

module.exports = User;

//Token authentication function
const authenticateToken = (req, res, next) => {
    const authHeader = req.header("Authorization");
    const token = authHeader && authHeader.split(" ")[1]; // Extract Bearer token

    console.log("🟡 Received Token:", token); // Debugging line

    if (!token) {
        console.error("❌ No token provided!");
        return res.status(401).json({ error: "Access denied. No token provided." });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET); // Check the secret key!
        console.log("🟢 Decoded User:", decoded); // Debugging line
        req.user = decoded;  // ✅ Store user info in req.user
        next();
    } catch (error) {
        console.error("🔴 JWT Error:", error.message);
        res.status(403).json({ error: "Invalid token" });
    }
};


// Forum Route (Protected)
app.get("/api/forum", authenticateToken, (req, res) => {
    res.json({ message: "Welcome to the Discussion Forum!" });
});

const nodemailer = require("nodemailer");

// Configure Nodemailer
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,  // 🔹 Use 587 instead of 465
    secure: false,  // 🔹 False for port 587
    auth: {
        user: "poulamibasu40@gmail.com",  // Replace with your email
        pass: "nyih xkxf abhz vjib",  // Use an App Password if using Gmail
    },
});



// const bcrypt = require("bcrypt");

app.post("/api/request-otp", async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1️⃣ Check if user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: "User not found" });
        }

        // 2️⃣ Verify Password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ error: "Incorrect password." });
        }

        // 3️⃣ Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10-minute expiry

        // 4️⃣ Save OTP to database
        user.otp = otp;
        user.otpExpires = otpExpires;
        await user.save();

        // 5️⃣ Send OTP via email
        await transporter.sendMail({
            from: "your-email@gmail.com",
            to: user.email,
            subject: "Your Login OTP",
            text: `Your OTP is ${otp}. It expires in 10 minutes.`,
        });

        res.json({ message: "OTP sent successfully" });
    } catch (error) {
        console.error("Error sending OTP:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


app.post("/api/verify-otp", async (req, res) => {
    const { email, otp, password } = req.body;

    // 1️⃣ Check if OTP is correct
    const user = await User.findOne({ email });
    if (!user || user.otp !== otp) {
        return res.status(400).json({ error: "Invalid OTP." });
    }

    // 2️⃣ Check if password is correct
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        return res.status(400).json({ error: "Incorrect password." });
    }

    // 3️⃣ Generate Token & Respond
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "1h" });
    res.json({ token });
});



app.put("/api/update-user", authenticateToken, async (req, res) => {
    const { username, email, password } = req.body;
    const userId = req.user.id; // ✅ Extract from `req.user`

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        // ✅ Update username & email
        user.username = username || user.username;
        user.email = email || user.email;

        // ✅ Hash new password before saving
        if (password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
        }


        await user.save();
        res.json({ message: "Profile updated successfully!", user });
    } catch (error) {
        console.error("Profile Update Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/api/quiz/next", async (req, res) => {
    const { userId, topic, questionIndex } = req.body;

    try {
        const quizQuestions = await Quiz.find({ topic });
        
        if (!quizQuestions || quizQuestions.length === 0) {
            return res.status(404).json({ error: "No quiz questions found" });
        }

        if (questionIndex >= quizQuestions.length) {
            return res.json({ message: "Quiz completed", completed: true });
        }

        res.json({ question: quizQuestions[questionIndex] });
    } catch (error) {
        console.error("Error fetching quiz question:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/api/quiz/answer", async (req, res) => {
    const { userId, questionId, selectedAnswer, questionIndex } = req.body;

    try {
        const question = await Quiz.findById(questionId);
        if (!question) {
            return res.status(404).json({ error: "Question not found" });
        }

        const isCorrect = selectedAnswer === question.correctAnswer;
        
        // Save progress (optional)
        await UserQuizProgress.updateOne(
            { userId },
            { $push: { answers: { questionId, selectedAnswer, isCorrect } } },
            { upsert: true }
        );

        res.json({ isCorrect, correctAnswer: question.correctAnswer, nextQuestionIndex: questionIndex + 1 });
    } catch (error) {
        console.error("Error processing answer:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});



app.post("/forum/post-question", async (req, res) => {
    try {
        const { userId, question } = req.body;
        
        // Fetch user details
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        const newPost = new ForumPost({
            userId,
            userName: user.username, // Assuming user model has a 'name' field
            question
        });

        await newPost.save();
        res.status(201).json({ message: "Question posted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/forum/get-questions", async (req, res) => {
    try {
        const questions = await ForumPost.find().sort({ date: -1 }); // Newest first
        res.status(200).json(questions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});


app.post("/forum/post-reply/:postId", async (req, res) => {
    try {
        const { userId, replyText } = req.body;
        const { postId } = req.params;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        const forumPost = await ForumPost.findById(postId);
        if (!forumPost) return res.status(404).json({ error: "Post not found" });

        const reply = {
            userId,
            userName: user.username,
            replyText
        };

        forumPost.replies.push(reply);
        await forumPost.save();

        res.status(201).json({ message: "Reply added successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});





// User Signup Route
app.post("/api/signup", async (req, res) => {
    const { username, email, password } = req.body;

    try {
        console.log("🔵 Signup request received:", req.body);

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log("⛔ User already exists:", existingUser);
            return res.status(400).json({ error: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, email, password: hashedPassword });

        console.log("🟢 New User to Save:", newUser);

        await newUser.save();
        console.log("✅ User Saved Successfully:", newUser);

        res.status(201).json({ message: "User registered successfully", userId: newUser._id });
    } catch (error) {
        console.error("❌ Signup Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/profile", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;  // ✅ Get user ID from token
        const user = await User.findById(userId).select("username email");
        if (!user) return res.status(404).json({ error: "User not found" });

        res.status(200).json(user);
    } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});




// User Login Route
app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: "Invalid email or password" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: "Invalid email or password" });
        }

        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1h" });

        console.log("🟢 Sending Login Response:", { token, userId: user._id }); // ✅ Debugging

        res.json({ token, userId: user._id }); // ✅ Send userId
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});



// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    console.log("Received Token:", authHeader); // ✅ Correct way to log

    if (!authHeader) return res.status(401).json({ error: "Access Denied" });

    const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: "Invalid token" });
        req.user = decoded;
        next();
    });
};

app.post("/api/user/:userId/save-history", async (req, res) => {
    try {
        const { searchQuery } = req.body; // 🔹 Get search query from frontend
        const user = await User.findById(req.params.userId);

        if (!user) return res.status(404).json({ error: "User not found" });

        user.searchHistory.push(searchQuery); // 🔹 Add search query to history
        user.searchCount += 1; // 🔹 Increase search count
        await user.save(); // 🔹 Save changes

        console.log("✅ Search history updated:", user.searchHistory);
        console.log("✅ Total searches:", user.searchCount);

        res.json({ 
            message: "History saved", 
            searchHistory: user.searchHistory, 
            searchCount: user.searchCount 
        });
    } catch (error) {
        console.error("❌ Error saving history:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});



// ✅ Fetch User Search History
app.get("/api/user/:userId/history", async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        res.json({
            searchHistory: user.searchHistory,
            searchCount: user.searchCount || 0, // ✅ Include search count
            quizCount: user.quizCount || 0 // ✅ Include quiz submissions count
        });
    } catch (error) {
        console.error("Error fetching history:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

//delete user search history
app.delete("/api/user/:userId/clear-history", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;

        // Find user and update history-related fields
        const user = await User.findByIdAndUpdate(userId, {
            $set: { searchHistory: [], searchCount: 0, quizCount: 0 }
        }, { new: true });

        if (!user) return res.status(404).json({ error: "User not found" });

        res.status(200).json({ message: "Search history cleared successfully" });
    } catch (error) {
        console.error("Error clearing history:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});



app.post("/api/user/:userId/submit-quiz", async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        user.quizCount += 1;  // ✅ Increment quiz submission count
        await user.save();

        res.json({ message: "Quiz submission recorded successfully", quizCount: user.quizCount });
    } catch (error) {
        console.error("Error saving quiz submission:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


app.post("/api/search", async (req, res) => {
    const { userId, query } = req.body;
    
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // ✅ Append search query to history
        user.searchHistory.push(query);
        await user.save();

        res.json({ message: "Search recorded" });
    } catch (error) {
        console.error("Error saving search:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


// Protected Route Example
app.get("/api/protected", verifyToken, (req, res) => {
    res.json({ message: "This is a protected route", user: req.user });
});

// Import Existing Routes
const youtubeRoute = require("./youtubeRoute");
const googleRoute = require("./googleRoute");
app.use("/api", youtubeRoute);
app.use("/api", googleRoute);

// Gemini Summarization API
app.post("/api/summary", async (req, res) => {
    const { topic } = req.body;

    if (!topic) {
        return res.status(400).json({ error: "Topic is required" });
    }

    try {
        const payload = {
            contents: [
                {
                    parts: [
                        {
                            text: `Summarize the following below 100 words: ${topic}. Also, suggest 3 related topics and generate the response starting with phrase 'Related topics:' . Just provide the topic names seperated by commas `
                        }
                    ]
                }
            ]
        };

        // Log the payload to verify it's correct
        console.log("Payload sent to Gemini API:", payload);

        // Send request to Gemini API
        const response = await axios.post(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
            payload,
            {
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );

        // Log the raw API response for debugging
        console.log("Gemini API response:", JSON.stringify(response.data, null, 2));

        // Check if candidates array is present and contains content
        if (response.data.candidates && response.data.candidates.length > 0) {
            const content = response.data.candidates[0].content;  // Extract content from 'content' object

            // Check if content contains text
            if (content && content.parts && content.parts[0] && content.parts[0].text) {
                const summary = content.parts[0].text;  // Extract the summary text
                res.json({ summary });
            } else {
                res.status(500).json({ error: "Failed to extract summary content." });
            }
        } else {
            res.status(500).json({ error: "Summarization failed." });
        }
    } catch (error) {
        // Log detailed error for debugging
        console.error("Error fetching summary:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Failed to generate summary." });
    }
});

// Gemini Translation API (Multiple Languages)
app.post("/api/translate", async (req, res) => {
    const { summary, targetLanguages } = req.body; // Expecting an array of languages

    if (!summary || !Array.isArray(targetLanguages) || targetLanguages.length === 0) {
        return res.status(400).json({ error: "Summary and targetLanguages array are required" });
    }

    try {
        console.log("Translating summary:", summary);
        console.log("Target languages:", targetLanguages);

        const translations = {};

        for (const lang of targetLanguages) {
            console.log(`Translating to ${lang}...`);

            // Prepare payload for Gemini translation
            const payload = {
                contents: [
                    {
                        parts: [
                            {
                                text: `Translate this text to ${lang}: "${summary}" .Don't give a starting line like Here is the translation..` // Prompt for translation
                            }
                        ]
                    }
                ]
            };

            let translationText = '';

            try {
                // Make the request to Gemini API for translation
                const response = await axios.post(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
                    payload,
                    {
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );

                // Log the response for debugging
                console.log("Gemini API response:", response.data);

                // Check if content exists and parse it
                if (response.data.candidates && response.data.candidates.length > 0) {
                    const content = response.data.candidates[0].content;
                    if (content && content.parts && content.parts[0] && content.parts[0].text) {
                        translationText = content.parts[0].text; // Extract the translated text
                        translations[lang] = translationText;
                        console.log(`Translated (${lang}):`, translationText);
                    } else {
                        translations[lang] = "Translation failed.";
                        console.error(`Failed to extract translated text for ${lang}:`, response.data);
                    }
                } else {
                    translations[lang] = "Translation failed.";
                    console.error(`Translation failed for ${lang}:`, response.data);
                }
            } catch (error) {
                translations[lang] = "Translation request failed.";
                console.error(`Error translating to ${lang}:`, error.response ? error.response.data : error.message);
            }
        }

        res.json({ summary, translations });
    } catch (error) {
        console.error("Error in translation:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Failed to translate summary." });
    }
});

// Gemini Roadmap API

// app.post("/api/roadmap", async (req, res) => {
//     const { topic } = req.body;

//     if (!topic) {
//         return res.status(400).json({ error: "Topic is required" });
//     }

//     try {
//         const payload = {
//             contents: [
//                 {
//                     parts: [
//                         {
//                             text: `Provide a well-structured and properly formatted study roadmap for learning ${topic}.Dont generate the response starting with a preface like "Here is the roadmap..",start the roadmap directly. Generate anywhere between 30-40 steps in the roadmap.`


//                         }
//                     ]
//                 }
//             ]
//         };

//         console.log("Payload sent to Gemini API:", payload);

//         const response = await axios.post(
//             "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
//             payload,
//             {
//                 headers: {
//                     "Content-Type": "application/json",
//                 },
//             }
//         );

//         console.log("Gemini API response:", JSON.stringify(response.data, null, 2));

//         if (response.data.candidates && response.data.candidates.length > 0) {
//             const content = response.data.candidates[0].content;

//             if (content && content.parts && content.parts[0] && content.parts[0].text) {
//                 const roadmap = content.parts[0].text;
//                 res.json({ roadmap });
//             } else {
//                 res.status(500).json({ error: "Failed to extract roadmap content." });
//             }
//         } else {
//             res.status(500).json({ error: "Roadmap generation failed." });
//         }
//     } catch (error) {
//         console.error("Error fetching roadmap:", error.response ? error.response.data : error.message);
//         res.status(500).json({ error: "Failed to generate roadmap." });
//     }
// });

// Gemini Roadmap API
const marked = require("marked"); // Import Markdown parser

app.post("/api/roadmap", async (req, res) => {
    const { topic, weeks } = req.body;

    if (!topic || !weeks) {
        return res.status(400).json({ error: "Topic and weeks are required" });
    }

    try {
        const payload = {
            contents: [
                {
                    parts: [
                        {
                            text: `Provide a well-structured and properly formatted study roadmap for learning ${topic} within ${weeks} weeks. 
                            Divide the roadmap into ${weeks} weekly sections, with key subtopics covered each week. 
                            Ensure the plan is sequential and progressive. Avoid starting with a preface like "Here is the roadmap"; start the roadmap directly. 
                            Generate anywhere between 30-40 steps in total, evenly spread across the weeks. Format using proper headings and bullet points.
                            Follow this format:
                            (bold)Week 1: <Week 1 title>(/bold)\n
                            (bullet points)
                            (bold)<subtopic> :(/bold) <a concise overview of the subtopic in no more than 10 words> \n
                            (bold)<subtopic> :(/bold) <a concise overview of the subtopic in no more than 10 words> \n
                            ....
                            (bold)Week 2: <Week 1 title>(/bold)\n
                            ....so on

                            `
                        }
                    ]
                }
            ]
        };

        console.log("Payload sent to Gemini API:", payload);

        const response = await axios.post(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
            payload,
            {
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );

        console.log("Gemini API response:", JSON.stringify(response.data, null, 2));

        if (response.data.candidates && response.data.candidates.length > 0) {
            const content = response.data.candidates[0].content;

            if (content && content.parts && content.parts[0] && content.parts[0].text) {
                let roadmapMarkdown = content.parts[0].text;
                let roadmapHtml = marked.parse(roadmapMarkdown); // Convert Markdown to HTML

                res.json({ roadmap: roadmapHtml }); // Send properly formatted HTML
            } else {
                res.status(500).json({ error: "Failed to extract roadmap content." });
            }
        } else {
            res.status(500).json({ error: "Roadmap generation failed." });
        }
    } catch (error) {
        console.error("Error fetching roadmap:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Failed to generate roadmap." });
    }
});



app.post("/api/quiz", async (req, res) => {
    const { topic } = req.body;
    console.log("✅ Incoming request:", req.body);
    
    if (!topic) {
        return res.status(400).json({ error: "Topic is required" });
    }
    
    try {
        // Create payload for Gemini API
        console.log("🔍 Creating payload for topic:", topic);
        const payload = {
            contents: [
                {
                    parts: [
                        {
                            text: `Generate 5 multiple-choice questions with 4 options each about: ${topic}. For each question, provide the correct answer at the end. Format each question as follows:
                            
                            **Question N:**
                            
                            [Question text]
                            
                            a) [Option A]
                            b) [Option B]
                            c) [Option C]
                            d) [Option D]
                            
                            **Correct Answer: [letter]) [Answer text]**`
                        }
                    ]
                }
            ]
        };
        
        console.log("📤 Sending request to Gemini API");
        const response = await axios.post(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
            payload,
            {
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );
        
        console.log("📥 Received response from Gemini API");
        
        // Extract text content from response
        const textContent = response.data.candidates[0].content.parts[0].text;
        console.log("📝 Raw text content length:", textContent.length);
        
        // Parse questions, options, and answers
        console.log("🔎 Beginning to parse quiz content");
        const questions = [];
        
        // Regex pattern to match each question block
        const questionPattern = /\*\*Question \d+:\*\*\s*\n\s*\n(.*?)\s*\n\s*\n(.*?)\*\*Correct Answer: ([a-d]\)) (.*?)\*\*/gs;
        let match;
        let questionId = 1;
        
        while ((match = questionPattern.exec(textContent)) !== null) {
            console.log(`\n⭐ Processing question ${questionId}`);
            
            // Extract question text
            const questionText = match[1].trim();
            console.log(`❓ Question: ${questionText}`);
            
            // Extract options section
            const optionsText = match[2].trim();
            console.log(`📋 Options section length: ${optionsText.length} characters`);
            
            // Parse individual options
            const options = [];
            const optionPattern = /([a-d]\)) (.*?)(?=\n[a-d]\)|\n\s*\n|$)/gs;
            let optionMatch;
            
            while ((optionMatch = optionPattern.exec(optionsText)) !== null) {
                const optionId = optionMatch[1].replace(')', '');
                const optionText = optionMatch[2].trim();
                console.log(`   Option ${optionId}: ${optionText}`);
                
                options.push({
                    id: optionId,
                    text: optionText
                });
            }
            
            // Extract correct answer
            const correctAnswerLetter = match[3].replace(')', '');
            console.log(`✅ Correct answer: ${correctAnswerLetter}`);
            
            // Add question to questions array
            questions.push({
                id: questionId,
                question: questionText,
                options: options,
                correctAnswer: correctAnswerLetter
            });
            
            questionId++;
        }
        
        console.log("🏁 Parsing complete! Generated structured data for", questions.length, "questions");
        
        if (questions.length === 0) {
            console.error("⚠️ No questions extracted. Raw response:", textContent);
            return res.status(500).json({ 
                error: "Failed to parse quiz questions",
                rawResponse: textContent.substring(0, 500) + "..."
            });
        }
        
        console.log("📊 First question structure:", JSON.stringify(questions[0], null, 2));
        
        // Return the structured quiz data
        return res.status(200).json({ 
            success: true, 
            data: questions 
        });
        
    } catch (error) {
        console.error("❌ Error generating quiz:", error);
        console.error("❌ Error stack:", error.stack);
        
        return res.status(500).json({ 
            error: "Failed to generate quiz", 
            details: error.message 
        });
    }
});

// Example backend route (Express.js)
app.post("/api/user/:userId/quizCompleted", async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        user.quizCount = (user.quizCount || 0) + 1;
        await user.save();

        res.json({ success: true, quizCount: user.quizCount });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


// Default Route
app.get("/", (req, res) => {
    res.send("AI Search API is running...");
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});




