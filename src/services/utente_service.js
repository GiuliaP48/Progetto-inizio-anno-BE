
const bcrypt = require('bcrypt');

const jwt = require('jsonwebtoken');

const { UAParser } = require('ua-parser-js');

const AppException = require('../eccezioni/app_eccezioni');

const utenteRepository = require('../repository/utente_repository');
const calendarioRepository = require('../repository/calendario_repository');

const refreshTokenService = require('./refresh_token_service');
const calendarioService = require('./calendario_service');
const notificaService = require('./notifica_service');
const eventoService = require('./evento_service');
const todoService = require('./to_do_service');
const notaService = require('./nota_service');


// Lettere (anche accentate), spazi e apostrofi: es. "Maria Chiara", "Nicolò", "D'Angelo"
const FORMATO_NOME = /^[A-Za-zÀ-ÖØ-öø-ÿ'’ ]+$/;

// Formato dell'email: lettere, numeri e . _ % + - prima della @, poi il dominio e un'estensione di almeno 2 lettere (es. nome.cognome@gmail.com)
// Niente spazi, virgole o altri simboli. L'email arriva già in minuscolo, quindi bastano le lettere minuscole
const FORMATO_EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

const LUNGHEZZA_MINIMA_NOME = 2;
const LUNGHEZZA_MASSIMA_NOME = 50;
const LUNGHEZZA_MINIMA_PASSWORD = 8;

// Controlla i dati di un utente e restituisce solo i campi ammessi
function validaUtente(dati, parziale = false) {
    const risultato = {};

    // In registrazione devono esserci tutti i campi obbligatoriamente
    if (!parziale) {
        // se è false --> controllo che ci siano TUTTI i campi
        for (const campo of ['nome', 'cognome', 'email', 'password']) {
            if (dati[campo] === undefined || dati[campo] === null || String(dati[campo]).trim().length === 0) {
                throw new AppException('Nome, cognome, email e password sono obbligatori', 400);
            }
        }
    }

    // Vincoli su nome e cognome
    for (const campo of ['nome', 'cognome']) {
        if (dati[campo] === undefined) continue;

        if (typeof dati[campo] !== 'string' || dati[campo].trim().length === 0) {
            throw new AppException(`Il ${campo} non può essere vuoto`, 400);
        }

        const valore = dati[campo].trim();

        if (valore.length < LUNGHEZZA_MINIMA_NOME || valore.length > LUNGHEZZA_MASSIMA_NOME) {
            throw new AppException(`Il ${campo} deve avere tra ${LUNGHEZZA_MINIMA_NOME} e ${LUNGHEZZA_MASSIMA_NOME} caratteri`, 400);
        }

        if (!FORMATO_NOME.test(valore)) {
            throw new AppException(`Il ${campo} può contenere solo lettere, spazi e apostrofi`, 400);
        }

        risultato[campo] = valore;
    }

    // Vincoli sull'email (salvata sempre in minuscolo)
    if (dati.email !== undefined) {
        if (typeof dati.email !== 'string' || dati.email.trim().length === 0) {
            throw new AppException("L'email non può essere vuota", 400);
        }

        const email = dati.email.trim().toLowerCase();

        if (!FORMATO_EMAIL.test(email)) {
            throw new AppException('Email non valida: usa il formato nome@dominio.it', 400);
        }

        risultato.email = email;
    }

    // Vincoli sulla password
    if (dati.password !== undefined) {
        if (typeof dati.password !== 'string' || dati.password.length < LUNGHEZZA_MINIMA_PASSWORD) {
            throw new AppException(`La password deve avere almeno ${LUNGHEZZA_MINIMA_PASSWORD} caratteri`, 400);
        }

        risultato.password = dati.password;
    }

    return risultato;
}

// Registrazione nuovo utente, controllando prima i dati e che l'email non sia già in uso
async function createUtente(nome, cognome, email, password) {
    const dati = validaUtente({ nome, cognome, email, password });

    const utenteEsistente = await utenteRepository.getUtenteByEmail(dati.email);
    if (utenteEsistente) {
        throw new AppException('Email già registrata', 409);
    }

    const password_hash = await bcrypt.hash(dati.password, 10);

    const nuovoUtente = await utenteRepository.createUtente({
        nome: dati.nome,
        cognome: dati.cognome,
        email: dati.email,
        password_hash,
    });

    // La password (anche cifrata) non va mai nella risposta
    const { password_hash: _, ...utenteSenzaPassword } = nuovoUtente;
    return utenteSenzaPassword;
}

// Profilo di un utente: l'email si vede solo nel proprio profilo
async function getProfiloById(id, utente_id) {
    const utente = await utenteRepository.getUtenteById(id);

    if (!utente) {
        throw new AppException('Utente non trovato', 404);
    }

    const { password_hash: _, email, ...datiPubblici } = utente;

    return utente_id === id ? { ...datiPubblici, email } : datiPubblici;
}

// Verifica credenziali di login (l'email viene cercata in minuscolo)
async function verificaCredenziali(email, password) {
    const utente = await utenteRepository.getUtenteByEmail(String(email).trim().toLowerCase());
    if (!utente) return null;

    const passwordCorretta = await bcrypt.compare(password, utente.password_hash);
    if (!passwordCorretta) return null;

    return utente;
}

// Rileva automaticamente il tipo di dispositivo da cui arriva la richiesta
function rilevaDispositivo(userAgent, nomeUtente) {
    const parser = new UAParser(userAgent);
    const risultato = parser.getResult();

    const tipoDispositivo = risultato.device.type; // 'mobile', 'tablet', o undefined
    const sistemaOperativo = risultato.os.name;

    let categoria;

    if (sistemaOperativo === 'iOS') {
        categoria = tipoDispositivo === 'tablet' ? 'iPad' : 'iPhone';
    } else if (sistemaOperativo === 'Android' || sistemaOperativo === 'HarmonyOS') {
        categoria = tipoDispositivo === 'tablet' ? 'Tablet' : 'Telefono';
    } else if (tipoDispositivo === 'mobile' || tipoDispositivo === 'tablet') {
        categoria = tipoDispositivo === 'tablet' ? 'Tablet' : 'Telefono';
    } else {
        categoria = 'Computer';
    }

    return `${categoria} di ${nomeUtente}`;
}

// Autenticazione utente
async function loginUtente(email, password, userAgent) {
    if (!email || !password) {
        throw new AppException('Email e password sono obbligatori', 400);
    }

    const utente = await verificaCredenziali(email, password);

    if (!utente) {
        throw new AppException('Credenziali non valide', 401);
    }

    const datiToken = {
        utente_id: utente.id,
        email: utente.email,
    };

    const token = jwt.sign(datiToken, process.env.SECRET_KEY, {
        expiresIn: '1h',
    });

    const dispositivo = rilevaDispositivo(userAgent, utente.nome);

    const refreshToken = await refreshTokenService.createRefreshToken(utente.id, dispositivo);

    const { password_hash: _, ...utenteSenzaPassword } = utente;

    return { token, refreshToken, utente: utenteSenzaPassword };
}

// Aggiornamento dati del profilo: si possono cambiare solo nome, cognome, email e password
async function updateProfilo(id, dati, utente_id) {
    if (id !== utente_id) {
        throw new AppException('Non autorizzato a modificare questo profilo', 403);
    }

    const datiValidati = validaUtente(dati, true);

    if (Object.keys(datiValidati).length === 0) {
        throw new AppException('Nessun campo valido da modificare', 400);
    }

    // La nuova email non deve appartenere a un altro utente
    if (datiValidati.email) {
        const altroUtente = await utenteRepository.getUtenteByEmail(datiValidati.email);
        if (altroUtente && altroUtente.id !== id) {
            throw new AppException('Email già registrata', 409);
        }
    }

    // Per cambiare la password serve anche quella attuale, che controllo con l'hash salvato.
    // password_attuale non viene salvata né restituita: validaUtente tiene solo nome, cognome, email e password
    if (datiValidati.password) {
        if (typeof dati.password_attuale !== 'string' || dati.password_attuale.length === 0) {
            throw new AppException('Per cambiare la password serve la password attuale', 400);
        }

        const utente = await utenteRepository.getUtenteById(id);
        const passwordCorretta = await bcrypt.compare(dati.password_attuale, utente.password_hash);

        // 400 e non 401, perché nel frontend il 401 serve per il rinnovo del token
        if (!passwordCorretta) {
            throw new AppException('La password attuale non è corretta', 400);
        }

        // La password non si salva mai in chiaro
        datiValidati.password_hash = await bcrypt.hash(datiValidati.password, 10);
        delete datiValidati.password;
    }

    const utenteAggiornato = await utenteRepository.updateUtente(id, datiValidati);

    const { password_hash: _, ...utenteSenzaPassword } = utenteAggiornato;
    return utenteSenzaPassword;
}

// Eliminazione account utente:
// - i calendari personali, e quelli condivisi in cui nessuno ha accettato l'invito, vengono eliminati
// - i calendari condivisi con almeno un membro che ha accettato passano al primo di questi, che diventa amministratore
// - viene tolto dai calendari degli altri, tutto quello che ha creato resta, ma senza il suo nome
async function deleteUtente(id, utente_id) {
    if (id !== utente_id) {
        throw new AppException('Non autorizzato a eliminare questo account', 403);
    }

    // Nome e cognome servono per le notifiche, dopo l'eliminazione l'utente non c'è più
    const utente = await utenteRepository.getUtenteById(id);

    const calendariAmministrati = await calendarioRepository.getCalendariByAmministratore(id);

    // Calendari che passano a un nuovo amministratore
    const cessioni = [];

    for (const calendario of calendariAmministrati) {
        // Il nuovo amministratore è il primo della lista che ha accettato l'invito
        const nuovoAmministratore = calendario.membri.find(membro => membro.stato_invito === 'accettato');

        if (calendario.tipo === 'personale' || !nuovoAmministratore) {
            await calendarioService.deleteCalendario(calendario.id, id);
        } else {
            cessioni.push({
                calendario,
                nuovoAmministratore,
                nuoviMembri: calendario.membri.filter(membro => membro.utente_id !== nuovoAmministratore.utente_id),
            });
        }
    }

    // Calendari degli altri in cui compare tra i membri, con qualsiasi stato dell'invito
    const calendariDaLasciare = await calendarioRepository.getCalendariConMembro(id);

    const uscite = calendariDaLasciare.map(calendario => ({
        calendario,
        nuoviMembri: calendario.membri.filter(membro => membro.utente_id !== id),
        avevaAccettato: calendario.membri.some(membro => membro.utente_id === id && membro.stato_invito === 'accettato'),
    }));

    await utenteRepository.deleteUtente(id, cessioni, uscite);

    // Avviso chi diventa amministratore
    for (const cessione of cessioni) {
        await notificaService.createNotificaNuovoAmministratore(cessione.nuovoAmministratore.utente_id, cessione.calendario, utente);
    }

    // Avviso gli amministratori dei calendari di cui faceva davvero parte (invito accettato)
    for (const uscita of uscite) {
        if (uscita.avevaAccettato) {
            await notificaService.createNotificaUscita(uscita.calendario, utente);
        }
    }
}

// Rinnovo dell'access token tramite un refresh token valido
async function updateAccessToken(refreshTokenRicevuto) {
    const utente_id = await refreshTokenService.updateRefreshToken(refreshTokenRicevuto);

    const utente = await utenteRepository.getUtenteById(utente_id);

    const datiToken = {
        utente_id: utente.id,
        email: utente.email,
    };

    const nuovoAccessToken = jwt.sign(datiToken, process.env.SECRET_KEY, {
        expiresIn: '1h',
    });

    return nuovoAccessToken;
}

// Riepilogo di oggi per l'area personale: eventi, todo da fare e note di oggi,
// in tutti i calendari che l'utente può vedere (quelli che amministra e quelli in cui ha accettato l'invito)
async function getRiepilogoOggi(utente_id) {
    const calendariAmministrati = await calendarioRepository.getCalendariByAmministratore(utente_id);
    const calendariDaMembro = await calendarioRepository.getCalendariByMembro(utente_id);

    const calendari = [...calendariAmministrati, ...calendariDaMembro];
    const calendarioIds = calendari.map(calendario => calendario.id);

    // Oggi senza l'ora, come in getResoconto (mezzanotte UTC, come sono salvate le date di todo e note)
    const adesso = new Date();
    const oggi = new Date(Date.UTC(adesso.getFullYear(), adesso.getMonth(), adesso.getDate()));

    // La stessa data nel formato AAAA-MM-GG, per la risposta
    const dataOggi = oggi.toISOString().slice(0, 10);

    if (calendari.length === 0) {
        return { data: dataOggi, eventi: [], todos: [], note: [] };
    }

    const eventi = await eventoService.getEventiOggi(calendari, oggi);
    const todos = await todoService.getTodosOggi(calendarioIds, oggi);
    const note = await notaService.getNoteOggi(calendarioIds, oggi);

    return { data: dataOggi, eventi, todos, note };
}

module.exports = {
    createUtente,
    getProfiloById,
    loginUtente,
    updateProfilo,
    deleteUtente,
    updateAccessToken,
    getRiepilogoOggi
};