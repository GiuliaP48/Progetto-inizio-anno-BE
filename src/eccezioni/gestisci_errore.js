
const AppException = require('./app_eccezioni');

// Risposta da mandare:
// - AppException lanciata con throw nel service --> rispondo con il suo status e il suo messaggio
// - id scritto male nell'URL o nel body (Prisma P2023, es. "abc" al posto di un ObjectId) --> 400 "Id non valido"
// - qualsiasi altro errore imprevisto --> lo scrivo nel terminale e rispondo 500 con il messaggio che mi passa il controller
function gestisciErrore(res, errore, messaggio) {
    if (errore instanceof AppException) {
        return res.status(errore.status).json({ errore: errore.message });
    }

    if (errore.code === 'P2023') {
        return res.status(400).json({ errore: 'Id non valido' });
    }

    console.error(errore);
    return res.status(500).json({ errore: messaggio });
}

module.exports = gestisciErrore;