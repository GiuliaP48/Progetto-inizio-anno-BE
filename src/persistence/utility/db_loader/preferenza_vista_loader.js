
const preferenzaVistaService = require('../../../services/preferenza_vista_service');

// - utenteEmail: utente che imposta la preferenza, uso l'email invece dell'utente_id, perché l'ID vero lo conosco solo dopo aver creato gli utenti
// - calendarioIndex posizione dell'array calendariCreati, mi serve perchè ogni preferenza_vista deve "sapere" a quale calendario appartiene
// - vista: deve avere dei valori dell'enum TipoFrequenzaEstesa (giornaliera | settimanale | mensile | annuale)

const preferenzaVistaData = [
    { utenteEmail: 'giulia.romano@gmail.com', calendarioIndex: 0, vista: 'settimanale' },
    { utenteEmail: 'giulia.romano@gmail.com', calendarioIndex: 1, vista: 'mensile' },
    { utenteEmail: 'andrea.bianchi@gmail.com', calendarioIndex: 2, vista: 'giornaliera' },
    { utenteEmail: 'andrea.bianchi@gmail.com', calendarioIndex: 3, vista: 'settimanale' },
    { utenteEmail: 'francesca.colombo@gmail.com', calendarioIndex: 4, vista: 'mensile' },
    { utenteEmail: 'riccardo.fontana@gmail.com', calendarioIndex: 5, vista: 'settimanale' },
    { utenteEmail: 'valentina.santoro@gmail.com', calendarioIndex: 6, vista: 'giornaliera' },
    { utenteEmail: 'lorenzo.gatti@gmail.com', calendarioIndex: 7, vista: 'mensile' },
    { utenteEmail: 'martina.villa@gmail.com', calendarioIndex: 8, vista: 'annuale' },
    { utenteEmail: 'simone.barbieri@gmail.com', calendarioIndex: 9, vista: 'settimanale' },
    // Un membro con una vista propria, diversa da quella dell'amministratrice (Giulia usa la mensile)
    { utenteEmail: 'riccardo.fontana@gmail.com', calendarioIndex: 1, vista: 'giornaliera' },
];

// Inserimento delle preferenze_vista (ricevo utentiCreati e calendariCreati con gli ID veri)
async function inserisciPreferenzeVista(utentiCreati, calendariCreati) {
    const preferenzeCreate = [];

    for (const dato of preferenzaVistaData) {
        const utente = utentiCreati.find(u => u.email === dato.utenteEmail);
        const calendario = calendariCreati[dato.calendarioIndex];

        if (!utente) {
            throw new Error(`Utente non trovato per email: ${dato.utenteEmail}`);
        }
        if (!calendario) {
            throw new Error(`Calendario non trovato all'indice: ${dato.calendarioIndex}`);
        }

        const preferenza = await preferenzaVistaService.setPreferenzaVista(
            calendario.id,
            dato.vista,
            utente.id
        );

        console.log(`Preferenza vista creata: ${utente.email} -> ${calendario.nome} = ${dato.vista}`);
        preferenzeCreate.push(preferenza);
    }

    return preferenzeCreate;
}

module.exports = { inserisciPreferenzeVista, preferenzaVistaData };