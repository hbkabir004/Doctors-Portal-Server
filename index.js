const express = require('express');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, Collection } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fkqwkjt.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const verifyJWT = (req, res, next)=>{
    const authHeader = req.headers.authorization;
    if(!authHeader){
        return res.send(401).send('unauthorized access');
    }

    const token = authHeader.split(' ')[1];
    
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })

}

async function run() {
    try {
        const appointmentOptionsCollection = client.db('doctors-portal').collection('appointmentOptions');
        const bookingsCollection = client.db('doctors-portal').collection('bookings');
        const usersCollection = client.db('doctors-portal').collection('users');

        app.get('/appointmentOptions', async (req, res) => {
            const date = req.query.date;
            // console.log(date);
            const query = {};
            const options = await appointmentOptionsCollection.find(query).toArray();
            const bookingQuery = {appointmentDate: date};
            const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray();

            options.map(option=>{
                const optionBooked = alreadyBooked.filter(book=>book.treatment == option.name);
                const bookedSlots = optionBooked.map(book=>book.slot);
                const remainingSlots = option.slots.filter(slot=> !bookedSlots.includes(slot));
                option.slots = remainingSlots;
                console.log(date, option.name, remainingSlots.length);
            })
            res.send(options);
        });

        app.get('/bookings', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = {email: email};
            const bookings = await bookingsCollection.find(query).toArray();
            res.send(bookings);
        });

        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: '' })
        });

        app.post('/bookings', async (req, res) => {
            const bookings = req.body;
            // console.log(bookings);
            const query = {
                appointmentDate: bookings.appointmentDate,
                email: bookings.email,
                treatment: bookings.treatment 
            }

            const alreadyBooked = await bookingsCollection.find(query).toArray();

            if (alreadyBooked.length){
                const message = `You already have a booking on ${bookings.appointmentDate}`
                return res.send({acknowledged: false, message})
            }

            const result = await bookingsCollection.insertOne(bookings);
            res.send(result);
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        app.get('/users', async (req, res) => {
            const query = { };
            const users = await usersCollection.find(query).toArray();
            res.send(users);
        });

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = {email};
            const user = await usersCollection.findOne(query);
            res.send({isAdmin : user?.role === 'admin'});
        });

        app.put('/users/admin/:id', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })


    }
    finally {


    }
}
run().catch(console.dir);



app.get('/', async (req, res) => {
    res.send('Server is running in full swing')
})


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})