
const utenteService = require('../../../services/utente_service');

// password in chiaro qui, verranno hashate in fase di inserimento
const utentiData = [
    { nome: 'Giulia', cognome: 'Romano', email: 'giulia.romano@gmail.com', password: 'GiuliaBlu2026!' },
    { nome: 'Andrea', cognome: 'Bianchi', email: 'andrea.bianchi@gmail.com', password: 'AndreaGialla2026!' },
    { nome: 'Francesca', cognome: 'Colombo', email: 'francesca.colombo@gmail.com', password: 'FrancescaRosa2026!' },
    { nome: 'Riccardo', cognome: 'Fontana', email: 'riccardo.fontana@gmail.com', password: 'RiccardoNera2026!' },
    { nome: 'Valentina', cognome: 'Santoro', email: 'valentina.santoro@gmail.com', password: 'ValentinaGrigia2026!' },
    { nome: 'Lorenzo', cognome: 'Gatti', email: 'lorenzo.gatti@gmail.com', password: 'LorenzoAzzurra2026!' },
    { nome: 'Martina', cognome: 'Villa', email: 'martina.villa@gmail.com', password: 'MartinaMarrone2026!' },
    { nome: 'Simone', cognome: 'Barbieri', email: 'simone.barbieri@gmail.com', password: 'SimoneBianca2026!' },
];

// Inserimento degli utenti nel database (restituisco gli utenti creati, con gli ID veri, per i loader successivi)
async function inserisciUtenti() {
    const utentiCreati = [];

    for (const dato of utentiData) {
        // NB: uso direttamente createUtente del service, che si occupa già dell'hashing con bcrypt
        const utente = await utenteService.createUtente(
            dato.nome,
            dato.cognome,
            dato.email,
            dato.password
        );
        console.log(`Utente creato: ${utente.nome} ${utente.cognome} (${utente.email})`);
        utentiCreati.push(utente);
    }

    return utentiCreati;
}

module.exports = { inserisciUtenti, utentiData };