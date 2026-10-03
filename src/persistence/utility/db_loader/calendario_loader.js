
const calendarioService = require('../../../services/calendario_service');

// Uso l'email invece dell'utente_id perché l'ID vero lo conosco solo dopo aver creato gli utenti
const calendariData = [
    { nome: 'Lavoro', tipo: 'personale', proprietarioEmail: 'giulia.romano@gmail.com', colore: '#4A90D9' },
    { nome: 'Famiglia Romano-Fontana', tipo: 'condiviso', proprietarioEmail: 'giulia.romano@gmail.com', colore: '#E27D60', permesso_modifica: 'tutti' },
    { nome: 'Università', tipo: 'personale', proprietarioEmail: 'andrea.bianchi@gmail.com', colore: '#8E44AD' },
    { nome: 'Progetto Tesi', tipo: 'condiviso', proprietarioEmail: 'andrea.bianchi@gmail.com', colore: '#27AE60', permesso_modifica: 'solo_amministratore' },
    { nome: 'Personale', tipo: 'personale', proprietarioEmail: 'francesca.colombo@gmail.com', colore: '#F39C12' },
    { nome: 'Palestra', tipo: 'personale', proprietarioEmail: 'riccardo.fontana@gmail.com', colore: '#C0392B' },
    { nome: 'Coinquilini', tipo: 'condiviso', proprietarioEmail: 'valentina.santoro@gmail.com', colore: '#16A085', permesso_modifica: 'tutti' },
    { nome: 'Lavoro', tipo: 'personale', proprietarioEmail: 'lorenzo.gatti@gmail.com', colore: '#2C3E50' },
    { nome: 'Viaggi', tipo: 'condiviso', proprietarioEmail: 'martina.villa@gmail.com', colore: '#D35400', permesso_modifica: 'personalizzato' },
    { nome: 'Personale', tipo: 'personale', proprietarioEmail: 'simone.barbieri@gmail.com', colore: '#7F8C8D' },
];

// Membri dei calendari condivisi: gli inviti sono veri, quindi la notifica di invito parte da sola
// - calendarioIndex: posizione nell'array calendariCreati
// - invitatoEmail: uso l'email perché l'invito si fa proprio tramite email
// - risposta: 'accettato' o 'rifiutato'; null = l'invito resta in attesa
// - puoModificare: se true, l'amministratore gli dà il permesso di modifica (serve nei calendari con permesso personalizzato)
const membriData = [
    { calendarioIndex: 1, invitatoEmail: 'riccardo.fontana@gmail.com', risposta: 'accettato' },
    { calendarioIndex: 1, invitatoEmail: 'martina.villa@gmail.com', risposta: null },
    { calendarioIndex: 3, invitatoEmail: 'francesca.colombo@gmail.com', risposta: 'accettato' },
    { calendarioIndex: 6, invitatoEmail: 'andrea.bianchi@gmail.com', risposta: 'accettato' },
    { calendarioIndex: 6, invitatoEmail: 'simone.barbieri@gmail.com', risposta: 'rifiutato' },
    { calendarioIndex: 8, invitatoEmail: 'giulia.romano@gmail.com', risposta: 'accettato', puoModificare: true },
];

// Inserisco i calendari nel database (ricevo utentiCreati, con gli ID veri così posso trasformare proprietarioEmail --> utente_id)
async function inserisciCalendari(utentiCreati) {
    const calendariCreati = [];

    for (const dato of calendariData) {
        const proprietario = utentiCreati.find(utente => utente.email === dato.proprietarioEmail);

        if (!proprietario) {
            throw new Error(`Utente non trovato per email: ${dato.proprietarioEmail}`);
        }

        const calendario = await calendarioService.createCalendario(
            dato.nome,
            dato.tipo,
            dato.colore,
            dato.permesso_modifica,
            proprietario.id
        );

        console.log(`Calendario creato: ${calendario.nome} (proprietario: ${proprietario.email})`);
        calendariCreati.push(calendario);
    }

    return calendariCreati;
}

// Invito i membri nei calendari condivisi, come farebbe l'amministratore dall'app
async function inserisciMembri(calendariCreati, utentiCreati) {
    for (const dato of membriData) {
        const calendario = calendariCreati[dato.calendarioIndex];
        const invitato = utentiCreati.find(utente => utente.email === dato.invitatoEmail);

        if (!calendario) {
            throw new Error(`Calendario non trovato all'indice: ${dato.calendarioIndex}`);
        }
        if (!invitato) {
            throw new Error(`Utente non trovato per email: ${dato.invitatoEmail}`);
        }

        // L'invito lo manda l'amministratore del calendario (calendario.utente_id)
        await calendarioService.inviteMembro(calendario.id, invitato.email, calendario.utente_id);

        // Risponde l'invitato stesso
        if (dato.risposta) {
            await calendarioService.updateStatoInvito(calendario.id, invitato.id, dato.risposta, invitato.id);
        }

        if (dato.puoModificare) {
            await calendarioService.updatePermessoMembro(calendario.id, invitato.id, true, calendario.utente_id);
        }

        // Scrivo nel terminale chi è stato invitato, in quale calendario e cosa ha risposto (se non ha risposto --> "in attesa")
        console.log(`Membro invitato: ${invitato.email} --> ${calendario.nome} (${dato.risposta || 'in attesa'})`);
    }
}

module.exports = { inserisciCalendari, inserisciMembri, calendariData, membriData };