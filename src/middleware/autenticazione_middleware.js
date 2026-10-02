
const jwt = require('jsonwebtoken');

const utenteRepository = require('../repository/utente_repository');

async function verificaToken(req, res, next) {
    const intestazioneAutorizzazione = req.headers.authorization;

    if (!intestazioneAutorizzazione) {
        return res.status(401).json({ errore: 'Token mancante' });
    }

    const partiIntestazione = intestazioneAutorizzazione.split(' ');

    if (partiIntestazione.length !== 2 || partiIntestazione[0] !== 'Bearer') {
        return res.status(401).json({ errore: 'Formato token non valido' });
    }

    const token = partiIntestazione[1];

    // Verifica firma e scadenza del token
    let datiToken;
    try {
        datiToken = jwt.verify(token, process.env.SECRET_KEY);
    } catch (errore) {
        if (errore.name === 'TokenExpiredError') {
            return res.status(401).json({ errore: 'Token scaduto' });
        }
        return res.status(401).json({ errore: 'Token non valido' });
    }

    // Verifica che l'utente esista ancora nel database 
    // (per risolvere il problema del token firmato che resta valido fino alla scadenza anche se l'utente nel frattempo è stato eliminato)
    try {
        const utente = await utenteRepository.getUtenteById(datiToken.utente_id);

        if (!utente) {
            return res.status(401).json({ errore: 'Utente non più esistente' });
        }
    } catch (errore) {
        return res.status(500).json({ errore: 'Errore durante la verifica dell\'utente' });
    }

    req.utente_id = datiToken.utente_id;
    req.utente_email = datiToken.email;

    next();
}

module.exports = verificaToken;