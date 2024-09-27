const express = require('express');
const mysql = require('mysql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');

const app = express();
const cors = require('cors')
app.use(bodyParser.json());
app.use(cors())
// Set up MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', // Replace with your MySQL password
    database: 'my-socmed'
});
db.connect((err) => {
    if (err) throw err;
    console.log('MySQL connected...');
});

// Secret for JWT
const JWT_SECRET = 'your_jwt_secret';

// Register Route
app.post('/register', (req, res) => {
    const { username, email, password } = req.body;
    // Check if user already exists
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, result) => {
        if (err) throw err;
        if (result.length > 0) {
            return res.status(400).json({ msg: 'User already exists' });
        }
        // Hash the password
        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) throw err;

            // Insert user into the database
            db.query(
                'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
                [username, email, hashedPassword],
                (err, result) => {
                    if (err) throw err;
                    res.status(201).json({ msg: 'User registered successfully' });
                }
            );
        });
    });
});
// Login Route
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Check if user exists
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, result) => {
        if (err) throw err;
        if (result.length === 0) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        const user = result[0];

        // Compare password
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) throw err;
            if (!isMatch) {
                return res.status(400).json({ msg: 'Invalid credentials' });
            }

            // Generate JWT token
            const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });

            res.json({ token });
        });
    });
});

// Get User (Protected Route)
app.get('/user', (req, res) => {
    //  .headers didapatkan dari fetching data
    const token = req.headers.authorization.split(' ')[1];
    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        db.query('SELECT id, username, email FROM users WHERE id = ?', [decoded.id], (err, result) => {
            if (err) throw err;
            res.json(result[0]);
        });
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
});


// CONTENT
app.get('/content', (req, res) => {
    try {
        // Updated SQL query to join contents with comments
        const query = `
        SELECT 
            c.*,
            GROUP_CONCAT(JSON_OBJECT('id', co.id, 'com', co.comments, 'name', u.username) SEPARATOR ',') AS comments
        FROM 
            contents c
        LEFT JOIN 
            comments co ON c.id = co.id_content
        LEFT JOIN 
            users u ON co.id_user = u.id 
        GROUP BY 
            c.id
        `;
        db.query(query, (err, result) => {
            if (err) throw err;
            res.json(result);
        });
    } catch (err) {
        res.status(401).json({ msg: 'Failed to fetch content' });
    }
});
app.post('/create-content', (req, res) => {
    console.log(req.body)
    const { title, description, author, likes_count } = req.body;
    try {
        db.query(
            'INSERT INTO contents (title, description, author, likes_count) VALUES (?, ?, ?, ?)',
            [title, description, author, likes_count],
            (err, result) => {
                if (err) throw err;
                res.status(201).json({ msg: 'Content created successfully' });
            }
        );
    } catch (err) {
        res.status(401).json({ msg: 'Failed create content' });
    }
});
// Update content (PUT)
app.put('/update-content/:id', (req, res) => {
    console.log(req.body)
    const { id } = req.params; // Get the content ID from the URL parameters
    const { title, description } = req.body; // Get the updated data from the request body
    try {
        db.query(
            'UPDATE contents SET title = ?, description = ? WHERE id = ?',
            [title, description, id],
            (err, result) => {
                if (err) throw err;
                if (result.affectedRows === 0) {
                    return res.status(404).json({ msg: 'Content not found' });
                }
                res.json({ msg: 'Content updated successfully' });
            }
        );
    } catch (err) {
        res.status(500).json({ msg: 'Failed to update content' });
    }
});

// Delete content (DELETE)
app.delete('/delete-content/:id', (req, res) => {
    const { id } = req.params; // Get the content ID from the URL parameters
    try {
        db.query(
            'DELETE FROM contents WHERE id = ?',
            [id],
            (err, result) => {
                if (err) throw err;
                if (result.affectedRows === 0) {
                    return res.status(404).json({ msg: 'Content not found' });
                }
                res.json({ msg: 'Content deleted successfully' });
            }
        );
    } catch (err) {
        res.status(500).json({ msg: 'Failed to delete content' });
    }
});

app.post('/like-content/:id', (req, res) => {
    const contentId = req.params.id;
    db.query('UPDATE contents SET likes_count = likes_count + 1 WHERE id = ?', [contentId], (err, result) => {
        if (err) throw err;
        res.json({ success: true });
    });
});
app.post('/dislike-content/:id', (req, res) => {
    const contentId = req.params.id;
    db.query('UPDATE contents SET likes_count = likes_count - 1 WHERE id = ?', [contentId], (err, result) => {
        if (err) throw err;
        res.json({ success: true });
    });
});
app.post('/add-comment/:id', (req, res) => {
    console.log(req.body)
    const contentId = Number(req.params.id);
    const { comments, id_user } = req.body;
    // Validate input
    if (!comments) {
        return res.status(400).json({ msg: 'comments are required' });
    }
    try {
        // Insert the comment into the comments table associated with contentId
        db.query(
            'INSERT INTO comments (comments, id_content, id_user) VALUES (?, ?, ?)',
            [comments, contentId, id_user],
            (err, result) => {
                if (err) throw err;
                res.status(201).json({ success: true, msg: 'Comment added successfully' });
                console.log(result)
            }
        );
    } catch (err) {
        res.status(500).json({ msg: 'Failed to add comment' });
    }
});
// Start the server
app.listen(3000, () => {
    console.log('Server running on port 3000');
});