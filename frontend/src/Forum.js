
import React, { useEffect, useState } from "react";
import axios from "axios";

const Forum = () => {
    const [questions, setQuestions] = useState([]);
    const [newQuestion, setNewQuestion] = useState("");
    const [replies, setReplies] = useState({});
    const [searchQuery, setSearchQuery] = useState(""); // New search state
    const [userId] = useState(localStorage.getItem("userId")); // Fetch logged-in userId

    useEffect(() => {
        fetchQuestions();
    }, []);

    const fetchQuestions = async () => {
        try {
            const response = await axios.get("https://intellisearchai.onrender.com/forum/get-questions");
            setQuestions(response.data);
        } catch (error) {
            console.error("Error fetching questions:", error);
        }
    };

    const postQuestion = async () => {
        if (!newQuestion.trim()) return alert("Question cannot be empty!");
        try {
            await axios.post("https://intellisearchai.onrender.com/forum/post-question", {
                userId,
                question: newQuestion
            });
            setNewQuestion("");
            fetchQuestions(); // Refresh questions
        } catch (error) {
            console.error("Error posting question:", error);
        }
    };

    const postReply = async (postId) => {
        if (!replies[postId] || !replies[postId].trim()) return alert("Reply cannot be empty!");
        try {
            await axios.post(`https://intellisearchai.onrender.com/forum/post-reply/${postId}`, {
                userId,
                replyText: replies[postId]
            });
            setReplies((prev) => ({ ...prev, [postId]: "" }));
            fetchQuestions(); // Refresh replies
        } catch (error) {
            console.error("Error posting reply:", error);
        }
    };

    // **Search Logic: Filter questions based on search query**
    const filteredQuestions = questions.filter(q =>
        q.question.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div style={{ fontFamily: "monospace" }}>
            {/* Full-width Header */}
            <div style={{
            width: "100vw",
            backgroundColor: "rgb(206, 101, 101)", // Background color
            color: "white",
            padding: "15px 20px",
            fontSize: "28px",
            fontWeight: "bold",
            position: "fixed",
            top: "70px",
            left: "0",
            zIndex: "1000",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            height: "100px",
        }}>
            <span>Discussion Forum</span>

            {/* Search Bar */}
            <input
                type="text"
                placeholder="Search for a post (eg. Machine Learning)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                    padding: "8px",
                    borderRadius: "5px",
                    border: "2px solid #ccc",
                    width: "400px",
                    marginRight: "20px"
                }}
            />
        </div>
    
            {/* Main Content Container */}
            <div style={{
                maxWidth: "1200px",
                margin: "0 auto",
                paddingTop: "150px", // To avoid hiding content under the fixed header
            }}>
                
                                <h3
                    style={{
                        marginBottom: "10px", // More spacing below
                        fontWeight: "bold",
                        fontSize: "28px", // Larger and more readable
                        color: "#333", // Darker text for contrast
                        textShadow: "1px 1px 3px rgba(0, 0, 0, 0.2)", // Soft shadow for depth
                        letterSpacing: "1px", // More aesthetic spacing
                        padding: "8px 15px", // Padding for a structured look
                        backgroundColor: "#f8f8f8", // Light background
                        borderRadius: "8px", // Rounded edges
                        display: "inline-block" // Avoids full-width background
                    }}
                >
                    ✨ Post Your Question Here ✨
                </h3>

    
                {/* New Question Input */}
                <textarea
                        value={newQuestion}
                        onChange={(e) => setNewQuestion(e.target.value)}
                        placeholder="Ask a question..."
                        rows="3"
                        style={{
                            width: "100%",
                            padding: "10px",
                            marginTop: "15px", // Moves it down
                            marginBottom: "10px",
                            borderRadius: "5px",
                            border: "2px solid #333", // Makes border bold
                            fontSize: "16px" // Slightly larger text
                        }}
                    />

                <button onClick={postQuestion} style={{ padding: "8px 15px", cursor: "pointer" }}>
                    Post
                </button>
    
                {/* Questions List */}
                <div style={{ marginTop: "20px" }}>
                    {filteredQuestions.length === 0 ? (
                        <p>No matching posts found.</p>
                    ) : (
                        filteredQuestions.map((q) => (
                            <div
                    key={q._id}
                    style={{
                        border: "2px solid black", // Black border
                        borderRadius: "10px", // Rounded corners
                        padding: "10px",
                        marginBottom: "15px",
                        backgroundColor: "rgb(239, 197, 197)", // Background color remains the same
                    }}
                    >

                                <p style={{ color: "black" }}><strong>{q.userName}</strong> ({new Date(q.date).toLocaleDateString()})</p>
                                <p style={{ color: "black" }}>{q.question}</p>
    
                                {/* Replies Section */}
                                <div style={{ marginTop: "10px" }}>
                                    {q.replies.map((reply, index) => (
                                        <div key={index} style={{ paddingLeft: "15px", borderLeft: "3px solid #ddd", marginTop: "5px" }}>
                                            <p><strong>{reply.userName}</strong> ({new Date(reply.date).toLocaleDateString()})</p>
                                            <p>{reply.replyText}</p>
                                        </div>
                                    ))}
                                </div>
    
                                {/* Reply Input */}
                                <textarea
                                    value={replies[q._id] || ""}
                                    onChange={(e) => setReplies({ ...replies, [q._id]: e.target.value })}
                                    placeholder="Write a reply..."
                                    rows="2"
                                    style={{ width: "100%", padding: "5px", marginTop: "8px", borderRadius: "10px", }}
                                />
                                <button onClick={() => postReply(q._id)} style={{ padding: "5px 10px", cursor: "pointer", marginTop: "5px" }}>
                                    Reply
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
    
    
    
};

export default Forum;
