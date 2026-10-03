
const notificaService = require('../../../services/notifica_service');

// NB: le notifiche normalmente NON si creano "a mano" perchè "nascono" automaticamente dal sistema:
// - quelle di invito partono da sole con gli inviti veri del calendario_loader (inserisciMembri);
// - quelle di avviso le crea createNotificaAvviso, chiamata da generateNotificheMancanti (il cron di ogni minuto) quando arriva l'orario dell'avviso, recuperando anche quelle che dovevano partire mentre il server era spento.
// Qui creo direttamente solo qualche promemoria, per avere dei dati demo visibili subito, perché generateNotificheMancanti() non scatterebbe su eventi futuri come quelli del seed.

// Notifiche di tipo "avviso_evento"
const notificheAvvisoData = [
    { destinatarioEmail: 'giulia.romano@gmail.com', eventoIndex: 0, messaggio: 'Promemoria: "Riunione settimanale team" inizia tra 15 minuti', letta: false },
    { destinatarioEmail: 'andrea.bianchi@gmail.com', eventoIndex: 2, messaggio: 'Promemoria: "Lezione di Basi di Dati" inizia tra 30 minuti', letta: true },
    { destinatarioEmail: 'francesca.colombo@gmail.com', eventoIndex: 4, messaggio: 'Promemoria: "Visita dentista" inizia tra 15 minuti', letta: false },
    { destinatarioEmail: 'riccardo.fontana@gmail.com', eventoIndex: 5, messaggio: 'Promemoria: "Allenamento palestra" inizia tra 15 minuti', letta: true },
];

// Inserimento delle notifiche (ricevo utentiCreati ed eventiCreati con gli ID veri)
async function inserisciNotifiche(utentiCreati, eventiCreati) {
    const notificheCreate = [];

    // Notifiche di tipo avviso_evento
    for (const dato of notificheAvvisoData) {
        const destinatario = utentiCreati.find(utente => utente.email === dato.destinatarioEmail);
        const evento = eventiCreati[dato.eventoIndex];

        if (!destinatario) {
            throw new Error(`Utente non trovato per email: ${dato.destinatarioEmail}`);
        }
        if (!evento) {
            throw new Error(`Evento non trovato all'indice: ${dato.eventoIndex}`);
        }

        let notifica = await notificaService.createNotificaAvviso(
            destinatario.id,
            evento.id,
            dato.messaggio
        );

        // codice per segnare subito la notifica come già letta
        if (dato.letta) {
            notifica = await notificaService.notificaLetta(notifica.id, destinatario.id);
        }

        console.log(`Notifica avviso creata: ${destinatario.email} -> "${evento.titolo}"`);
        notificheCreate.push(notifica);
    }

    return notificheCreate;
}

module.exports = { inserisciNotifiche, notificheAvvisoData };