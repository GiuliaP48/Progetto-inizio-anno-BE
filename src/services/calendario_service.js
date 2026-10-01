
const AppException = require('../eccezioni/app_eccezioni');

const calendarioRepository = require('../repository/calendario_repository');
const utenteRepository = require('../repository/utente_repository');

const notificaService = require('./notifica_service');

// Valori ammessi dagli enum dello schema Prisma
const TIPI_VALIDI = ['personale', 'condiviso'];
const PERMESSI_VALIDI = ['solo_amministratore', 'tutti', 'personalizzato'];

// Risposte ammesse a un invito
const RISPOSTE_VALIDE = ['accettato', 'rifiutato'];


const LUNGHEZZA_MASSIMA_NOME = 50;

// Colore nel formato #RRGGBB (es. #33A1FF)
const FORMATO_COLORE = /^#[0-9A-Fa-f]{6}$/;

// Controlla i dati di un calendario e restituisce solo i campi ammessi
function validaCalendario(dati, parziale = false) {
    const risultato = {};

    // In creazione nome e tipo devono esserci obbligatoriamente
    if (!parziale) {
        const nomeMancante = typeof dati.nome !== 'string' || dati.nome.trim().length === 0;
        if (nomeMancante || !dati.tipo) {
            throw new AppException('Nome e tipo sono obbligatori', 400);
        }
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

    // Vincoli sul tipo (solo in creazione)
    if (!parziale) {
        if (!TIPI_VALIDI.includes(dati.tipo)) {
            throw new AppException('Tipo non valido: usa personale o condiviso', 400);
        }

        risultato.tipo = dati.tipo;
    }

    // Vincoli sul colore (facoltativo)
    if (dati.colore !== undefined) {
        if (typeof dati.colore !== 'string' || !FORMATO_COLORE.test(dati.colore)) {
            throw new AppException('Colore non valido: usa il formato #RRGGBB', 400);
        }

        risultato.colore = dati.colore;
    }

    // Vincoli sul permesso di modifica (facoltativo)
    if (dati.permesso_modifica !== undefined) {
        if (!PERMESSI_VALIDI.includes(dati.permesso_modifica)) {
            throw new AppException('Permesso di modifica non valido: usa solo_amministratore, tutti o personalizzato', 400);
        }

        risultato.permesso_modifica = dati.permesso_modifica;
    }

    return risultato;
}

// Prepara i calendari per la risposta: nome, cognome ed email dell'amministratore e di ogni membro.
async function aggiungiDatiCalendari(calendari) {
    const ids = new Set();
    calendari.forEach(calendario => {
        ids.add(calendario.utente_id);
        calendario.membri.forEach(membro => ids.add(membro.utente_id));
    });

    const utenti = await utenteRepository.getUtentiByIds([...ids]);
    const utentiPerId = new Map(utenti.map(utente => [utente.id, utente]));

    // Da un id restituisce utente_id, nome, cognome ed email, oppure null se l'id non c'è
    function datiPersona(id) {
        if (!id) return null;
        const utente = utentiPerId.get(id);
        return {
            utente_id: id,
            nome: utente ? utente.nome : null,
            cognome: utente ? utente.cognome : null,
            email: utente ? utente.email : null,
        };
    }

    return calendari.map(calendario => {
        const { evento_ids, membri, ...dati } = calendario;
        return {
            ...dati,
            amministratore: datiPersona(calendario.utente_id),
            membri: membri.map(membro => {
                const { utente_id, ...resto } = membro;
                return {
                    ...datiPersona(utente_id),
                    ...resto,
                };
            }),
        };
    });
}

// Creazione di un nuovo calendario (personale o condiviso)
async function createCalendario(nome, tipo, colore, permesso_modifica, utente_id) {
    const dati = validaCalendario({ nome, tipo, colore, permesso_modifica });

    const nuovoCalendario = await calendarioRepository.createCalendario({
        nome: dati.nome,
        tipo: dati.tipo,
        utente_id,
        colore: dati.colore,
        permesso_modifica: dati.tipo === 'condiviso' ? (dati.permesso_modifica || 'solo_amministratore') : null,
        membri: [],
    });

    const [calendarioCompleto] = await aggiungiDatiCalendari([nuovoCalendario]);
    return calendarioCompleto;
}

// Recupera i dettagli di un calendario con nome, cognome ed email di amministratore e membri
async function getCalendarioById(id, utente_id) {
    const calendario = await calendarioRepository.getCalendarioById(id);

    if (!calendario) {
        throw new AppException('Calendario non trovato', 404);
    }

    if (!utentePuoVedereCalendario(calendario, utente_id)) {
        throw new AppException('Non hai accesso a questo calendario', 403);
    }

    const [calendarioCompleto] = await aggiungiDatiCalendari([calendario]);
    return calendarioCompleto;
}

// Lista dei calendari a cui l'utente ha accesso (come amministratore o come membro)
// Non mostra gli altri membri: solo i dati del calendario e cosa può fare chi fa la richiesta
async function getCalendariByUtente(utente_id) {
    const comeAmministratore = await calendarioRepository.getCalendariByAmministratore(utente_id);
    const comeMembro = await calendarioRepository.getCalendariByMembro(utente_id);

    const calendari = [...comeAmministratore, ...comeMembro];

    return Promise.all(
        calendari.map(async calendario => {
            const { membri, evento_ids, ...dati } = calendario;
            return {
                ...dati,
                mio_ruolo: calendario.utente_id === utente_id ? 'amministratore' : 'membro',
                posso_modificare: await puoModificareCalendario(calendario, utente_id),
                numero_membri: membri.filter(membro => membro.stato_invito === 'accettato').length,
            };
        })
    );
}

// Invito di un utente a un calendario condiviso, tramite email
async function inviteMembro(calendario_id, email, utente_id) {
    const calendario = await calendarioRepository.getCalendarioById(calendario_id);

    if (!calendario) {
        throw new AppException('Calendario non trovato', 404);
    }

    if (calendario.utente_id !== utente_id) {
        throw new AppException('Solo l\'amministratore può invitare membri', 403);
    }

    if (!email) {
        throw new AppException('L\'email è obbligatoria', 400);
    }

    // L'email viene cercata in minuscolo, come viene salvata in registrazione
    const utente = await utenteRepository.getUtenteByEmail(String(email).trim().toLowerCase());

    if (!utente) {
        throw new AppException('Utente non trovato', 400);
    }

    // Un calendario personale non può avere membri
    if (calendario.tipo === 'personale') {
        throw new AppException('Non è possibile invitare membri in un calendario personale', 400);
    }

    // L'amministratore non può invitare sé stesso
    if (calendario.utente_id === utente.id) {
        throw new AppException('Non puoi invitare te stesso', 400);
    }

    const membroEsistente = calendario.membri.find(membro => membro.utente_id === utente.id);

    // Se è già nella lista ed è in attesa o ha accettato, non si può reinvitare
    if (membroEsistente && membroEsistente.stato_invito !== 'rifiutato') {
        throw new AppException('Utente già membro di questo calendario', 409);
    }

    let calendarioAggiornato;

    if (membroEsistente) {
        // In caso di rifiuto, può essere reinvitato
        const nuoviMembri = calendario.membri.map(membro => {
            if (membro.utente_id === utente.id) {
                return { ...membro, ruolo: 'membro', puo_modificare: false, stato_invito: 'in_attesa' };
            }
            return membro;
        });
        calendarioAggiornato = await calendarioRepository.updateMembri(calendario_id, nuoviMembri);
    } else {
        // Nuovo invito
        const nuovoMembro = {
            utente_id: utente.id,
            ruolo: 'membro',
            puo_modificare: false,
            stato_invito: 'in_attesa',
        };
        calendarioAggiornato = await calendarioRepository.addMembro(calendario_id, nuovoMembro);
    }

    await notificaService.createNotificaInvito(utente.id, calendario);

    const [calendarioCompleto] = await aggiungiDatiCalendari([calendarioAggiornato]);
    return calendarioCompleto;
}

// Rimozione di un membro: l'amministratore può rimuovere chiunque, un membro può rimuovere solo sé stesso (uscita dal calendario)
async function removeMembro(calendario_id, membro_id, utente_id) {
    const calendario = await calendarioRepository.getCalendarioById(calendario_id);

    if (!calendario) {
        throw new AppException('Calendario non trovato', 404);
    }

    // Controllo se chi fa la richiesta è l'amministratore del calendario
    const utenteAmministratore = calendario.utente_id === utente_id;

    // Controllo se chi fa la richiesta sta rimuovendo sé stesso (cioè sta uscendo)
    const utenteEsce = membro_id === utente_id;

    if (!utenteAmministratore && !utenteEsce) {
        throw new AppException('Non hai i permessi per rimuovere questo membro', 403);
    }

    // L'amministratore non può uscire dal proprio calendario
    if (membro_id === calendario.utente_id) {
        throw new AppException("L'amministratore non può uscire dal proprio calendario", 400);
    }

    const membroEsiste = calendario.membri.some(membro => membro.utente_id === membro_id);

    if (!membroEsiste) {
        throw new AppException('Membro non trovato', 404);
    }

    // Nuova lista senza il membro rimosso
    const nuoviMembri = calendario.membri.filter(membro => membro.utente_id !== membro_id);

    // Tolgo il membro dalla lista e cancello la sua preferenza vista per questo calendario
    const calendarioAggiornato = await calendarioRepository.rimuoviMembro(calendario_id, nuoviMembri, membro_id);

    if (utenteEsce) {
        // Il membro è uscito da solo: avvisa l'amministratore
        const membro = await utenteRepository.getUtenteById(membro_id);
        await notificaService.createNotificaUscita(calendario, membro);
    } else {
        // L'amministratore ha rimosso il membro: avvisa il membro rimosso
        await notificaService.createNotificaRimozione(membro_id, calendario);
    }

    const [calendarioCompleto] = await aggiungiDatiCalendari([calendarioAggiornato]);
    return calendarioCompleto;
}

// Accettazione o rifiuto di un invito da parte dell'utente invitato (una sola risposta possibile)
async function updateStatoInvito(calendario_id, membro_id, risposta, utente_id) {
    const calendario = await calendarioRepository.getCalendarioById(calendario_id);

    if (!calendario) {
        throw new AppException('Calendario non trovato', 404);
    }

    // Si può rispondere solo ai propri inviti
    if (membro_id !== utente_id) {
        throw new AppException('Puoi rispondere solo ai tuoi inviti', 403);
    }

    const membro = calendario.membri.find(membro => membro.utente_id === membro_id);

    if (!membro) {
        throw new AppException('Invito non trovato', 404);
    }

    // Vincoli sulla risposta
    if (!RISPOSTE_VALIDE.includes(risposta)) {
        throw new AppException('Risposta non valida: usa accettato o rifiutato', 400);
    }

    // Si può rispondere solo a un invito ancora in attesa
    if (membro.stato_invito !== 'in_attesa') {
        throw new AppException('Hai già risposto a questo invito', 409);
    }

    const nuoviMembri = calendario.membri.map(membro => {
        if (membro.utente_id === membro_id) {
            return { ...membro, stato_invito: risposta };
        }
        return membro;
    });

    const calendarioAggiornato = await calendarioRepository.updateMembri(calendario_id, nuoviMembri);

    const [calendarioCompleto] = await aggiungiDatiCalendari([calendarioAggiornato]);
    return calendarioCompleto;
}

// Modifica del permesso di modifica di un membro specifico (solo amministratore)
async function updatePermessoMembro(calendario_id, membro_id, puo_modificare, utente_id) {
    const calendario = await calendarioRepository.getCalendarioById(calendario_id);

    if (!calendario) {
        throw new AppException('Calendario non trovato', 404);
    }

    if (calendario.utente_id !== utente_id) {
        throw new AppException('Solo l\'amministratore può modificare i permessi', 403);
    }

    const membroEsiste = calendario.membri.some(membro => membro.utente_id === membro_id);

    if (!membroEsiste) {
        throw new AppException('Membro non trovato', 404);
    }

    if (typeof puo_modificare !== 'boolean') {
        throw new AppException('puo_modificare deve essere true o false', 400);
    }

    const nuoviMembri = calendario.membri.map(membro => {
        if (membro.utente_id === membro_id) {
            return { ...membro, puo_modificare };
        }
        return membro;
    });

    const calendarioAggiornato = await calendarioRepository.updateMembri(calendario_id, nuoviMembri);

    const [calendarioCompleto] = await aggiungiDatiCalendari([calendarioAggiornato]);
    return calendarioCompleto;
}

// Verifica se un utente può modificare un calendario (proprietario, o membro con permesso)
async function puoModificareCalendario(calendario, utente_id) {
    if (calendario.utente_id === utente_id) {
        return true; // l'ammministratore può sempre modificare
    }

    const membro = calendario.membri.find(m => m.utente_id === utente_id);

    if (!membro || membro.stato_invito !== 'accettato') {
        return false; // non è membro, o non ha ancora accettato l'invito
    }

    if (calendario.permesso_modifica === 'tutti') {
        return true;
    }

    if (calendario.permesso_modifica === 'personalizzato') {
        return membro.puo_modificare;
    }

    return false; // permesso_modifica === 'solo_amministratore'
}

// Verifica se un utente può vedere un calendario (amministratore, o membro che ha accettato l'invito)
function utentePuoVedereCalendario(calendario, utente_id) {
    if (calendario.utente_id === utente_id) {
        return true;
    }

    return calendario.membri.some(
        membro => membro.utente_id === utente_id && membro.stato_invito === 'accettato'
    );
}

// Modifica dati di un calendario: si possono cambiare solo nome, colore e permesso_modifica
async function updateCalendario(id, dati, utente_id) {
    const calendario = await calendarioRepository.getCalendarioById(id);

    if (!calendario) {
        throw new AppException('Calendario non trovato', 404);
    }

    if (calendario.utente_id !== utente_id) {
        throw new AppException('Solo l\'amministratore può modificare il calendario', 403);
    }

    const datiDaAggiornare = validaCalendario(dati, true);

    if (Object.keys(datiDaAggiornare).length === 0) {
        throw new AppException('Nessun campo valido da modificare', 400);
    }

    // Il permesso di modifica vale solo nei calendari condivisi
    if (datiDaAggiornare.permesso_modifica !== undefined && calendario.tipo === 'personale') {
        throw new AppException('Il permesso di modifica vale solo per i calendari condivisi', 400);
    }

    const calendarioAggiornato = await calendarioRepository.updateCalendario(id, datiDaAggiornare);

    const [calendarioCompleto] = await aggiungiDatiCalendari([calendarioAggiornato]);
    return calendarioCompleto;
}

// Eliminazione calendario
async function deleteCalendario(id, utente_id) {
    const calendario = await calendarioRepository.getCalendarioById(id);

    if (!calendario) {
        throw new AppException('Calendario non trovato', 404);
    }

    if (calendario.utente_id !== utente_id) {
        throw new AppException('Solo l\'amministratore può eliminare il calendario', 403);
    }

    await calendarioRepository.deleteCalendario(id);

    // Avviso i membri che avevano accettato l'invito: chi era ancora in attesa perde solo l'invito
    for (const membro of calendario.membri) {
        if (membro.stato_invito === 'accettato') {
            await notificaService.createNotificaEliminazione(membro.utente_id, calendario);
        }
    }
}

module.exports = {
    createCalendario,
    getCalendarioById,
    getCalendariByUtente,
    inviteMembro,
    removeMembro,
    updateStatoInvito,
    updatePermessoMembro,
    puoModificareCalendario,
    utentePuoVedereCalendario,
    updateCalendario,
    deleteCalendario,
};