
const AppException = require('../eccezioni/app_eccezioni');

const tagRepository = require('../repository/tag_repository');
const calendarioRepository = require('../repository/calendario_repository');
const utenteRepository = require('../repository/utente_repository');

const calendarioService = require('./calendario_service');

// Colore nel formato #RRGGBB (es. #2ECC71)
const FORMATO_COLORE = /^#[0-9A-Fa-f]{6}$/;

const LUNGHEZZA_MASSIMA_NOME = 30;

// Controlla i dati di un tag e restituisce solo i campi ammessi 
function validaTag(dati, parziale = false) {
    const risultato = {};

    // Campo nome obbligatorio
    if (!parziale && (typeof dati.nome !== 'string' || dati.nome.trim().length === 0)) {
        throw new AppException('Il nome è obbligatorio', 400);
    }

    // Vincoli sul nome
    if (dati.nome !== undefined) {
        if (typeof dati.nome !== 'string' || dati.nome.trim().length === 0) {
            throw new AppException('Il nome non può essere vuoto', 400);
        }

        const nome = dati.nome.trim();

        if (nome.length > LUNGHEZZA_MASSIMA_NOME) {
            throw new AppException(`Il nome può avere al massimo ${LUNGHEZZA_MASSIMA_NOME} caratteri`, 400);
        }

        risultato.nome = nome;
    }

    // Vincoli sul colore (facoltativo)
    if (dati.colore !== undefined) {
        if (typeof dati.colore !== 'string' || !FORMATO_COLORE.test(dati.colore)) {
            throw new AppException('Colore non valido: usa il formato #RRGGBB', 400);
        }

        risultato.colore = dati.colore;
    }

    return risultato;
}

// Controlla che nel calendario non ci sia già un tag con lo stesso nome, senza distinguere maiuscole e minuscole.
async function verificaNomeDisponibile(calendario_id, nome, tag_id_modificato = null) {
    const tags = await tagRepository.getTagsByCalendario(calendario_id);

    // tag_id_modificato: in modifica è l'id del tag che si sta rinominando.
    // Nel controllo dei doppioni questo tag viene saltato, altrimenti troverebbe sé stesso.
    // In creazione vale null perchè il tag non esiste ancora.
    const duplicato = tags.some(
        tag => tag.id !== tag_id_modificato && tag.nome.toLowerCase() === nome.toLowerCase()
    );

    if (duplicato) {
        throw new AppException('Esiste già un tag con questo nome in questo calendario', 409);
    }
}

// Prepara i tag per la risposta: nome e cognome di chi li ha creati e modificati, numero di eventi collegati.
async function aggiungiDatiTag(tags) {
    const ids = new Set();
    tags.forEach(tag => {
        if (tag.creato_da) ids.add(tag.creato_da);
        if (tag.modificato_da) ids.add(tag.modificato_da);
    });

    const utenti = await utenteRepository.getUtentiByIds([...ids]);
    const utentiPerId = new Map(utenti.map(utente => [utente.id, utente]));

    // Da un id restituisce { utente_id, nome, cognome }, oppure null se l'id non c'è
    function datiPersona(id) {
        if (!id) return null;
        const utente = utentiPerId.get(id);
        return {
            utente_id: id,
            nome: utente ? utente.nome : null,
            cognome: utente ? utente.cognome : null,
        };
    }

    return tags.map(tag => {
        const { evento_ids, creato_da, modificato_da, ...dati } = tag;
        return {
            ...dati,
            numero_eventi: evento_ids.length,
            creato_da: datiPersona(creato_da),
            modificato_da: datiPersona(modificato_da),
        };
    });
}

// Creazione di un tag in un calendario (solo chi può modificare il calendario)
async function createTag(calendario_id, nome, colore, utente_id) {
    const calendario = await calendarioRepository.getCalendarioById(calendario_id);

    if (!calendario) {
        throw new AppException('Calendario non trovato', 404);
    }

    const puoModificare = await calendarioService.puoModificareCalendario(calendario, utente_id);

    if (!puoModificare) {
        throw new AppException('Non autorizzato a creare tag in questo calendario', 403);
    }

    const dati = validaTag({ nome, colore });

    await verificaNomeDisponibile(calendario_id, dati.nome);

    const nuovoTag = await tagRepository.createTag({
        nome: dati.nome,
        colore: dati.colore,
        calendario_id,
        creato_da: utente_id,
    });

    const [tagCompleto] = await aggiungiDatiTag([nuovoTag]);
    return tagCompleto;
}

// Lista dei tag di un calendario, in ordine alfabetico (solo amministratore e membri che hanno accettato)
async function getTagsByCalendario(calendario_id, utente_id) {
    const calendario = await calendarioRepository.getCalendarioById(calendario_id);

    if (!calendario) {
        throw new AppException('Calendario non trovato', 404);
    }

    if (!calendarioService.utentePuoVedereCalendario(calendario, utente_id)) {
        throw new AppException('Non hai accesso a questo calendario', 403);
    }

    const tags = await tagRepository.getTagsByCalendario(calendario_id);

    tags.sort((a, b) => a.nome.localeCompare(b.nome, 'it'));

    return aggiungiDatiTag(tags);
}

// Modifica di un tag: si possono cambiare solo nome e colore
async function updateTag(id, dati, utente_id) {
    const tag = await tagRepository.getTagById(id);

    if (!tag) {
        throw new AppException('Tag non trovato', 404);
    }

    const calendario = await calendarioRepository.getCalendarioById(tag.calendario_id);

    const puoModificare = await calendarioService.puoModificareCalendario(calendario, utente_id);

    if (!puoModificare) {
        throw new AppException('Non autorizzato a modificare questo tag', 403);
    }

    const datiValidati = validaTag(dati, true);

    if (Object.keys(datiValidati).length === 0) {
        throw new AppException('Nessun campo valido da modificare', 400);
    }

    if (datiValidati.nome) {
        await verificaNomeDisponibile(tag.calendario_id, datiValidati.nome, id);
    }

    const tagAggiornato = await tagRepository.updateTag(id, {
        ...datiValidati,
        modificato_da: utente_id,
    });

    const [tagCompleto] = await aggiungiDatiTag([tagAggiornato]);
    return tagCompleto;
}

// Eliminazione di un tag, verificando i permessi
async function deleteTag(id, utente_id) {
    const tag = await tagRepository.getTagById(id);

    if (!tag) {
        throw new AppException('Tag non trovato', 404);
    }

    const calendario = await calendarioRepository.getCalendarioById(tag.calendario_id);

    const puoModificare = await calendarioService.puoModificareCalendario(calendario, utente_id);

    if (!puoModificare) {
        throw new AppException('Non autorizzato a eliminare questo tag', 403);
    }

    return tagRepository.deleteTag(id);
}

module.exports = {
    createTag,
    getTagsByCalendario,
    updateTag,
    deleteTag,
};