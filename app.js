
const express = require('express');

const app = express();

const cors = require('cors');

// Permette al frontend di chiamare le API
app.use(cors());

// Middleware per leggere il body delle richieste in formato JSON
app.use(express.json());

// Collegamento delle rotte di RefreshToken, con prefisso /utenti
app.use('/utenti', require('./src/routes/refresh_token_routes'));

// Collegamento delle rotte di Utente, con prefisso /utenti
app.use('/utenti', require('./src/routes/utente_routes'));

// Collegamento delle rotte di Tag, con prefisso /tags
app.use('/tags', require('./src/routes/tag_routes'));

// Collegamento delle rotte di Calendario, con prefisso /calendari
app.use('/calendari', require('./src/routes/calendario_routes'));

// Collegamento delle rotte di Notifica, con prefisso /notifiche
app.use('/notifiche', require('./src/routes/notifica_routes'));

// Collegamento delle rotte di Nota, con prefisso /note
app.use('/note', require('./src/routes/nota_routes'));

// Collegamento delle rotte di Preferenza_vista, con prefisso /preferenze-vista
app.use('/preferenze-vista', require('./src/routes/preferenza_vista_routes'));

// Collegamento delle rotte di Evento, con prefisso /eventi
app.use('/eventi', require('./src/routes/evento_routes'));

// Collegamento delle rotte di To-do, con prefisso /todos
app.use('/todos', require('./src/routes/to_do_routes'));

// Collegamento delle rotte di Elemento-to-do, con prefisso /elementi-to-do
app.use('/elementi-to-do', require('./src/routes/elemento_to_do_routes'));

// Rotta non trovata: se nessuna rotta sopra corrisponde all'indirizzo chiamato, rispondo in JSON invece della pagina HTML di Express
app.use((req, res) => {
    res.status(404).json({ errore: 'Rotta non trovata' });
});

// Errori che non arrivano ai controller (es. body JSON scritto male): rispondo sempre in JSON
// Express riconosce questo blocco come gestore degli errori perché ha 4 parametri, quindi next va scritto anche se non lo uso
app.use((errore, req, res, next) => {
    if (errore.type === 'entity.parse.failed') {
        return res.status(400).json({ errore: 'Body JSON non valido' });
    }

    console.error(errore);
    res.status(500).json({ errore: 'Errore interno del server' });
});

module.exports = app;