
const tagService = require('../services/tag_service');

const gestisciErrore = require('../eccezioni/gestisci_errore');

// POST /tags/crea/:calendarioId
async function createTag(req, res) {
    try {
        const { nome, colore } = req.body;

        const nuovoTag = await tagService.createTag(req.params.calendarioId, nome, colore, req.utente_id);

        res.status(201).json(nuovoTag);
    } catch (errore) {
        // Se due persone creano nello stesso momento un tag con lo stesso nome, tutte e due superano il controllo dei doppioni:
        // è il database (vincolo @@unique) a bloccare il secondo, e qui rispondo 409 (nome già usato) invece di 500 (errore del server)
        if (errore.code === 'P2002') {
            return res.status(409).json({ errore: 'Esiste già un tag con questo nome in questo calendario' });
        }
        gestisciErrore(res, errore, 'Errore durante la creazione del tag');
    }
}

// GET /tags/lista/:calendarioId
async function getTagsByCalendario(req, res) {
    try {
        const tags = await tagService.getTagsByCalendario(req.params.calendarioId, req.utente_id);
        res.status(200).json(tags);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore nel recupero dei tag');
    }
}

// PUT /tags/modifica/:id
async function updateTag(req, res) {
    try {
        const tagAggiornato = await tagService.updateTag(req.params.id, req.body, req.utente_id);
        res.status(200).json(tagAggiornato);
    } catch (errore) {
        // Se due persone rinominano nello stesso momento due tag con lo stesso nome, tutte e due superano il controllo dei doppioni:
        // è il database (vincolo @@unique) a bloccare il secondo, e qui rispondo 409 (nome già usato) invece di 500 (errore del server)
        if (errore.code === 'P2002') {
            return res.status(409).json({ errore: 'Esiste già un tag con questo nome in questo calendario' });
        }
        gestisciErrore(res, errore, 'Errore durante la modifica del tag');
    }
}

// DELETE /tags/elimina/:id
async function deleteTag(req, res) {
    try {
        await tagService.deleteTag(req.params.id, req.utente_id);
        res.status(204).send();
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante l\'eliminazione del tag');
    }
}

module.exports = {
    createTag,
    getTagsByCalendario,
    updateTag,
    deleteTag,
};