
require('dotenv').config();

const app = require('./app');

const cron = require('node-cron');

const notificaService = require('./src/services/notifica_service');

const popolaDb = require('./src/persistence/utility/popola_db');

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log(`Server avviato sulla porta ${PORT}`);

    // Popolo il database con i dati demo (solo la prima volta: se ci sono già, non fa niente)
    await popolaDb();
});

cron.schedule('* * * * *', async () => {
    // Il try/catch impedisce che un errore blocchi il cron job: senza di esso, un errore fermerebbe l'intera esecuzione, 
    // così il controllo riparte comunque al minuto successivo
    try {
        await notificaService.generateNotificheMancanti();
    } catch (errore) {
        console.error('Errore nel controllo avvisi eventi:', errore);
    }
});

// Ogni giorno alle 3:00 elimina le notifiche già lette più vecchie di 30 giorni
// 0 3 * * * --> al minuto 0 delle ore 3, ogni giorno
cron.schedule('0 3 * * *', async () => {
    try {
        await notificaService.eliminaNotificheVecchie();
    } catch (errore) {
        console.error('Errore nella pulizia delle notifiche:', errore);
    }
});