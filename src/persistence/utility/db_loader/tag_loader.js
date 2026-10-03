
const tagService = require('../../../services/tag_service');

// - calendarioIndex posizione dell'array calendariCreati, mi serve perchè ogni tag deve "sapere" a quale calendario appartiene
// - utenteEmail: utente che crea il tag, uso l'email invece dell'utente_id, perché l'ID vero lo conosco solo dopo aver creato gli utenti
// NB: utenteEmail serve per il controllo permessi nel service (puoModificareCalendario) e viene salvato nel Tag come creato_da

const tagData = [
    { nome: 'Urgente', colore: '#E74C3C', calendarioIndex: 0, utenteEmail: 'giulia.romano@gmail.com' },
    { nome: 'Riunioni', colore: '#3498DB', calendarioIndex: 0, utenteEmail: 'giulia.romano@gmail.com' },
    { nome: 'Compleanni', colore: '#F1C40F', calendarioIndex: 1, utenteEmail: 'giulia.romano@gmail.com' },
    { nome: 'Esami', colore: '#9B59B6', calendarioIndex: 2, utenteEmail: 'andrea.bianchi@gmail.com' },
    { nome: 'Scadenze tesi', colore: '#E67E22', calendarioIndex: 3, utenteEmail: 'andrea.bianchi@gmail.com' },
    { nome: 'Salute', colore: '#1ABC9C', calendarioIndex: 4, utenteEmail: 'francesca.colombo@gmail.com' },
    { nome: 'Allenamenti', colore: '#2ECC71', calendarioIndex: 5, utenteEmail: 'riccardo.fontana@gmail.com' },
    { nome: 'Casa', colore: '#34495E', calendarioIndex: 6, utenteEmail: 'valentina.santoro@gmail.com' },
    { nome: 'Colloqui', colore: '#D35400', calendarioIndex: 7, utenteEmail: 'lorenzo.gatti@gmail.com' },
    { nome: 'Viaggi', colore: '#16A085', calendarioIndex: 8, utenteEmail: 'martina.villa@gmail.com' },
    { nome: 'Bollette', colore: '#C0392B', calendarioIndex: 9, utenteEmail: 'simone.barbieri@gmail.com' },
];

// Inserimento dei tag (ricevo calendariCreati e utentiCreati con gli ID veri)
async function inserisciTag(calendariCreati, utentiCreati) {
    const tagCreati = [];

    for (const dato of tagData) {
        const calendario = calendariCreati[dato.calendarioIndex];
        const utente = utentiCreati.find(utente => utente.email === dato.utenteEmail);

        if (!utente) {
            throw new Error(`Utente non trovato per email: ${dato.utenteEmail}`);
        }
        if (!calendario) {
            throw new Error(`Calendario non trovato all'indice: ${dato.calendarioIndex}`);
        }

        const tag = await tagService.createTag(
            calendario.id,
            dato.nome,
            dato.colore,
            utente.id
        );

        console.log(`Tag creato: ${tag.nome} (calendario: ${calendario.nome})`);
        tagCreati.push(tag);
    }

    return tagCreati;
}

module.exports = { inserisciTag, tagData };