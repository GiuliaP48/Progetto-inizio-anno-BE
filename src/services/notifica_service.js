
const AppException = require('../eccezioni/app_eccezioni');

const notificaRepository = require('../repository/notifica_repository');
const eventoRepository = require('../repository/evento_repository');
const calendarioRepository = require('../repository/calendario_repository');
const utenteRepository = require('../repository/utente_repository');

// Per quanto tempo si tengono le notifiche già lette prima di eliminarle in automatico (30 giorni, in millisecondi)
const DURATA_CONSERVAZIONE = 30 * 24 * 60 * 60 * 1000;

// Creazione notifica di tipo "invito_calendario" (inviata all'utente che deve essere invitato, con il nome di chi invita e del calendario)
async function createNotificaInvito(utente_id, calendario) {
    const amministratore = await utenteRepository.getUtenteById(calendario.utente_id);

    return notificaRepository.createNotifica({
        tipo: 'invito_calendario',
        messaggio: `${amministratore.nome} ${amministratore.cognome} ti ha invitato al calendario "${calendario.nome}"`,
        utente_id,
        calendario_id: calendario.id,
    });
}

// Creazione notifica di tipo "rimozione_calendario" (inviata al membro che viene rimosso dall'amministratore)
async function createNotificaRimozione(utente_id, calendario) {
    const amministratore = await utenteRepository.getUtenteById(calendario.utente_id);

    return notificaRepository.createNotifica({
        tipo: 'rimozione_calendario',
        messaggio: `${amministratore.nome} ${amministratore.cognome} ti ha rimosso dal calendario "${calendario.nome}"`,
        utente_id,
        calendario_id: calendario.id,
    });
}

// Creazione notifica di tipo "uscita_calendario" (inviata all'amministratore quando un membro esce)
async function createNotificaUscita(calendario, membro) {
    return notificaRepository.createNotifica({
        tipo: 'uscita_calendario',
        messaggio: `${membro.nome} ${membro.cognome} ha lasciato il calendario "${calendario.nome}"`,
        utente_id: calendario.utente_id,
        calendario_id: calendario.id,
    });
}

// Creazione notifica di tipo "eliminazione_calendario" (inviata ai membri quando l'amministratore elimina il calendario)
// Non ha calendario_id perché il calendario non esiste più
async function createNotificaEliminazione(utente_id, calendario) {
    const amministratore = await utenteRepository.getUtenteById(calendario.utente_id);

    return notificaRepository.createNotifica({
        tipo: 'eliminazione_calendario',
        messaggio: `${amministratore.nome} ${amministratore.cognome} ha eliminato il calendario "${calendario.nome}"`,
        utente_id,
    });
}

// Creazione notifica di tipo "nuovo_amministratore" (inviata al membro che diventa amministratore quando l'amministratore elimina l'account)
async function createNotificaNuovoAmministratore(utente_id, calendario, vecchioAmministratore) {
    return notificaRepository.createNotifica({
        tipo: 'nuovo_amministratore',
        messaggio: `${vecchioAmministratore.nome} ${vecchioAmministratore.cognome} ha eliminato l'account: ora sei l'amministratore del calendario "${calendario.nome}"`,
        utente_id,
        calendario_id: calendario.id,
    });
}

// Recupero delle notifiche di un utente, eventualmente solo lette o solo non lette (filtro stato = lette / non_lette)
async function getNotificheByUtente(utente_id, stato) {
    // Vincoli sul filtro: può essere solo "lette" o "non_lette"
    let filtroLetta;
    if (stato !== undefined) {
        if (stato !== 'lette' && stato !== 'non_lette') {
            throw new AppException('Stato non valido: usa lette o non_lette', 400);
        }

        filtroLetta = stato === 'lette';
    }

    const notifiche = await notificaRepository.getNotificheByUtente(utente_id, filtroLetta);

    // Tolgo utente_id dalla risposta perchè le notifiche sono sempre dell'utente che le chiede, quindi è un dato inutile
    return notifiche.map(({ utente_id, ...dati }) => dati);
}

// Segna una notifica come letta, verificando che appartenga all'utente
async function notificaLetta(id, utente_id) {
    const notifica = await notificaRepository.getNotificaById(id);

    if (!notifica) {
        throw new AppException('Notifica non trovata', 404);
    }

    if (notifica.utente_id !== utente_id) {
        throw new AppException('Non autorizzato a modificare questa notifica', 403);
    }

    const { utente_id: _, ...notificaAggiornata } = await notificaRepository.segnaComeLetta(id);
    return notificaAggiornata;
}

// Segna come lette tutte le notifiche non lette dell'utente e restituisce quante sono state aggiornate
async function segnaTutteLette(utente_id) {
    const risultato = await notificaRepository.segnaTutteComeLette(utente_id);
    return { notifiche_aggiornate: risultato.count };
}

// Eliminazione notifica, verificando che appartenga all'utente
async function deleteNotifica(id, utente_id) {
    const notifica = await notificaRepository.getNotificaById(id);

    if (!notifica) {
        throw new AppException('Notifica non trovata', 404);
    }

    if (notifica.utente_id !== utente_id) {
        throw new AppException('Non autorizzato a eliminare questa notifica', 403);
    }

    return notificaRepository.deleteNotifica(id);
}

// Creazione notifica di tipo "avviso_evento"
async function createNotificaAvviso(utente_id, evento_id, messaggio) {
    return notificaRepository.createNotifica({
        tipo: 'avviso_evento',
        messaggio,
        utente_id,
        evento_id,
    });
}

// Controllo degli eventi con avviso scaduto e genera le notifiche mancanti
async function generateNotificheMancanti() {
    const adesso = new Date();

    // Il controllo parte ogni minuto: cerco anche gli eventi iniziati da meno di un minuto,
    // così quelli con avviso 0 ricevono comunque la notifica "inizia adesso"
    const eventiConAvviso = await eventoRepository.getEventiFuturiConAvviso(new Date(adesso.getTime() - 60000));

    for (const evento of eventiConAvviso) {
        const orarioAvviso = new Date(evento.data_inizio.getTime() - evento.avviso * 60000);

        if (orarioAvviso <= adesso) {

            // Minuti che mancano davvero all'inizio: se il server è ripartito in ritardo, sono meno di quelli dell'avviso iniziale
            const minutiMancanti = Math.round((evento.data_inizio.getTime() - adesso.getTime()) / 60000);

            let messaggio = `Promemoria: "${evento.titolo}" inizia adesso`;
            if (minutiMancanti === 1) {
                messaggio = `Promemoria: "${evento.titolo}" inizia tra 1 minuto`;
            } else if (minutiMancanti > 1) {
                messaggio = `Promemoria: "${evento.titolo}" inizia tra ${minutiMancanti} minuti`;
            }

            for (const calendario_id of evento.calendario_ids) {
                const calendario = await calendarioRepository.getCalendarioById(calendario_id);
                if (!calendario) continue;

                const destinatari = [calendario.utente_id, ...calendario.membri
                    .filter(membro => membro.stato_invito === 'accettato')
                    .map(membro => membro.utente_id)];

                for (const utente_id of destinatari) {
                    const giaEsiste = await notificaRepository.existsNotificaAvviso(evento.id, utente_id);
                    if (!giaEsiste) {
                        await createNotificaAvviso(utente_id, evento.id, messaggio);
                    }
                }
            }
        }
    }
}

// Eliminazione delle notifiche già lette più vecchie di DURATA_CONSERVAZIONE (quelle non lette restano sempre)
async function eliminaNotificheVecchie() {
    const limite = new Date(Date.now() - DURATA_CONSERVAZIONE);
    return notificaRepository.deleteNotificheLetteVecchie(limite);
}

module.exports = {
    createNotificaInvito,
    createNotificaRimozione,
    createNotificaUscita,
    createNotificaEliminazione,
    createNotificaNuovoAmministratore,
    createNotificaAvviso,
    generateNotificheMancanti,
    eliminaNotificheVecchie,
    getNotificheByUtente,
    notificaLetta,
    segnaTutteLette,
    deleteNotifica,
};