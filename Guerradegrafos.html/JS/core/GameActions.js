// js/core/GameActions.js
GraphWarGame.prototype.setupEventListeners = function() {
    this.nodesLayer.addEventListener('click', (event) => {
        const clickedElement = event.target.closest('.territory');
        if (clickedElement && clickedElement.dataset.id) {
            const territoryId = parseInt(clickedElement.dataset.id);
            this.handleTerritoryClick(territoryId);
        }
    });

    this.reinforceBtn.addEventListener('click', () => this.handleReinforceBtnClick());
    this.attackBtn.addEventListener('click', () => this.handleAttackBtnClick());
    this.fortifyBtn.addEventListener('click', () => this.handleFortifyBtnClick());
    this.endTurnBtn.addEventListener('click', () => this.endTurn());

    // Não adicionamos listeners aqui para os botões do modal de fortificação,
    // pois eles serão adicionados e removidos dinamicamente na função showFortifyModal.
    // Isso evita que múltiplos listeners sejam anexados a cada vez que o modal é aberto.
};

GraphWarGame.prototype.handleTerritoryClick = function(territoryId) {
    const territory = this.territories.find(t => t.id === territoryId);
    if (!territory || this.currentPlayer !== 'player') return;

    switch (this.gamePhase) {
        case 'reinforcement':
            if (territory.owner === 'player') {
                this.selectedTerritory = territoryId;
                this.showMessage(`Reforçar ${territory.name}? Clique "Reforçar" ou selecione outro.`);
            } else {
                this.showMessage('Só pode reforçar seus territórios.');
                this.selectedTerritory = null;
            }
            break;
        case 'attack':
            if (this.attackSource === null) { // Selecting source
                if (territory.owner === 'player' && territory.armies > 1) {
                    this.attackSource = territoryId;
                    this.selectedTerritory = territoryId;
                    this.showMessage(`Atacar de ${territory.name}. Selecione um alvo inimigo/neutro adjacente.`);
                    this.addToBattleLog(`Preparando ataque de ${territory.name}.`);
                } else if (territory.owner === 'player') {
                    this.showMessage('Mínimo de 2 exércitos para atacar.');
                } else {
                    this.showMessage('Selecione um território seu para atacar.');
                }
            } else { // Selecting target
                const source = this.territories.find(t => t.id === this.attackSource);
                if (territoryId === this.attackSource) {
                    this.attackSource = null; this.selectedTerritory = null;
                    this.showMessage('Ataque cancelado.'); this.addToBattleLog('Ataque cancelado.');
                } else if (territory.owner === 'player') {
                    this.showMessage('Não pode atacar seu próprio território.');
                } else if (!source.neighbors.includes(territoryId)) {
                    this.showMessage('Só pode atacar territórios vizinhos.');
                } else {
                    this.resolveAttack(this.attackSource, territoryId);
                }
            }
            break;
        case 'fortification':
            if (this.fortifySource === null) { // Selecting source
                if (territory.owner === 'player' && territory.armies > 1) {
                    this.fortifySource = territoryId;
                    this.selectedTerritory = territoryId;
                    this.showMessage(`Mover de ${territory.name}. Selecione um território aliado adjacente.`);
                } else if (territory.owner === 'player') {
                    this.showMessage('Mínimo de 2 exércitos para mover.');
                } else {
                    this.showMessage('Selecione um território seu para mover tropas.');
                }
            } else { // Selecting target
                const source = this.territories.find(t => t.id === this.fortifySource);
                if (territoryId === this.fortifySource) {
                    this.fortifySource = null; this.selectedTerritory = null;
                    this.showMessage('Fortificação cancelada.');
                } else if (territory.owner !== 'player') {
                    this.showMessage('Só pode fortificar para territórios aliados.');
                } else if (!source.neighbors.includes(territoryId)) {
                    this.showMessage('Só pode fortificar para territórios vizinhos.');
                } else {
                    // Chamar a função para exibir o modal de fortificação
                    this.showFortifyModal(this.fortifySource, territoryId);
                }
            }
            break;
    }
    this.updateUI();
};

GraphWarGame.prototype.handleReinforceBtnClick = function() {
    if (this.gamePhase !== 'reinforcement' || this.currentPlayer !== 'player') return;
    if (this.selectedTerritory === null || this.reinforcementsAvailable <= 0) {
        this.showMessage('Selecione um território seu e tenha reforços disponíveis.');
        return;
    }
    const territory = this.territories.find(t => t.id === this.selectedTerritory);
    if (!territory || territory.owner !== 'player') {
        this.showMessage('Só pode reforçar territórios seus.'); return;
    }

    territory.armies += 1;
    this.reinforcementsAvailable -= 1;
    this.updateTerritoryDisplay(this.selectedTerritory);
    this.updateGameStats();
    this.showMessage(`Reforço adicionado a ${territory.name}. Restam ${this.reinforcementsAvailable}.`);
    this.addToBattleLog(`Reforço para ${territory.name} (total: ${territory.armies}).`);

    if (this.reinforcementsAvailable <= 0) {
        this.gamePhase = 'attack';
        this.selectedTerritory = null;
        this.showMessage('Fase de ataque. Ataque, fortifique ou termine o turno.');
        this.addToBattleLog('Reforços esgotados. Fase de ataque.');
    }
    this.updateUI();
};

GraphWarGame.prototype.handleAttackBtnClick = function() {
    if (this.currentPlayer !== 'player' || this.gamePhase === 'attack') return;
    if (this.gamePhase === 'reinforcement' && this.reinforcementsAvailable > 0) {
        this.addToBattleLog(`Jogador pulou ${this.reinforcementsAvailable} reforços.`);
        this.reinforcementsAvailable = 0;
    }
    this.gamePhase = 'attack';
    this.selectedTerritory = null; this.attackSource = null; this.fortifySource = null;
    this.showMessage('Fase de ataque. Selecione origem e alvo, ou pule para fortificar/terminar.');
    this.addToBattleLog('Fase de ataque iniciada.');
    this.updateUI();
};

GraphWarGame.prototype.handleFortifyBtnClick = function() {
    if (this.currentPlayer !== 'player' || this.gamePhase === 'fortification') return;
    this.gamePhase = 'fortification';
    this.selectedTerritory = null; this.attackSource = null; this.fortifySource = null;
    this.showMessage('Fase de fortificação. Selecione origem e destino, ou termine o turno.');
    this.addToBattleLog('Fase de fortificação iniciada.');
    this.updateUI();
};

GraphWarGame.prototype.resolveAttack = function(attackerId, defenderId) {
    const attacker = this.territories.find(t => t.id === attackerId);
    const defender = this.territories.find(t => t.id === defenderId);

    if (attacker.armies < 2) {
        this.showMessage('Atacante precisa de no mínimo 2 exércitos.');
        this.attackSource = null; this.selectedTerritory = null; this.updateUI(); return;
    }
    let battleMessage = "";

    if (defender.owner === 'neutral') {
        defender.owner = attacker.owner;
        const armiesToMove = Math.min(attacker.armies - 1, Math.max(1, Math.floor((attacker.armies -1) / 2) + ((attacker.armies -1) % 2) ));
        attacker.armies -= armiesToMove;
        defender.armies = armiesToMove; // Neutral tinha 1, agora tem os movidos
        battleMessage = `Você conquistou ${defender.name}! ${armiesToMove} tropas movidas.`;
        this.addToBattleLog(`${attacker.name} conquistou ${defender.name} (neutro) com ${armiesToMove} tropas.`);
    } else { // Batalha contra IA/outro jogador
        const maxAttackingDice = Math.min(3, attacker.armies - 1);
        const maxDefendingDice = Math.min(2, defender.armies);
        const attackRolls = Array.from({ length: maxAttackingDice }, () => Math.floor(Math.random() * 6) + 1).sort((a, b) => b - a);
        const defenseRolls = Array.from({ length: maxDefendingDice }, () => Math.floor(Math.random() * 6) + 1).sort((a, b) => b - a);
        let attackerLosses = 0;
        let defenderLosses = 0;
        const comparisons = Math.min(attackRolls.length, defenseRolls.length);

        for (let i = 0; i < comparisons; i++) {
            if (attackRolls[i] > defenseRolls[i]) defenderLosses++;
            else attackerLosses++;
        }
        attacker.armies -= attackerLosses;
        defender.armies -= defenderLosses;

        const attackerDiceHtml = attackRolls.map(r => `<span class="dice ${attacker.owner}-dice">${r}</span>`).join('');
        const defenderDiceHtml = defenseRolls.map(r => `<span class="dice ${defender.owner}-dice">${r}</span>`).join('');

        if (defender.armies <= 0) {
            defender.owner = attacker.owner;
            const armiesToMoveAfterWin = Math.min(attacker.armies - 1, Math.max(1, maxAttackingDice - attackerLosses));
            if(attacker.armies - armiesToMoveAfterWin >=1){
                attacker.armies -= armiesToMoveAfterWin;
                defender.armies = armiesToMoveAfterWin;
            } else {
                defender.armies = attacker.armies -1; // Mover tudo menos 1
                attacker.armies = 1;
            }
            battleMessage = `Você conquistou ${defender.name}!`;
            this.addToBattleLog(`<b>Vitória!</b> ${attacker.name} (${attacker.owner}) conquistou ${defender.name}.<br>Dados: ${attackerDiceHtml} vs ${defenderDiceHtml}.<br>Perdas: ${attacker.owner} ${attackerLosses}, ${defender.owner} ${defenderLosses}. Tropas movidas: ${defender.armies}.`);
        } else {
            battleMessage = `Batalha: ${attacker.name} vs ${defender.name}. Suas perdas: ${attackerLosses}, Perdas IA: ${defenderLosses}.`;
            this.addToBattleLog(`<b>Batalha:</b> ${attacker.name} vs ${defender.name}.<br>Dados: ${attackerDiceHtml} vs ${defenderDiceHtml}.<br>Perdas: ${attacker.owner} ${attackerLosses}, ${defender.owner} ${defenderLosses}.<br>${defender.name} resistiu com ${defender.armies} tropas.`);
        }
    }
    this.showMessage(battleMessage);
    this.updateTerritoryDisplay(attackerId);
    this.updateTerritoryDisplay(defenderId);
    this.updateGameStats();
    this.attackSource = null; this.selectedTerritory = null;
    if (this.checkGameEnd()) return; // checkGameEnd in GameRules.js
    
    const canPlayerAttackAgain = this.territories.some(t => t.owner === 'player' && t.armies > 1 && t.neighbors.some(nId => this.territories.find(terr => terr.id === nId)?.owner !== 'player'));
    if (!canPlayerAttackAgain && this.currentPlayer === 'player') {
        this.showMessage('Nenhum ataque válido restante. Fortifique ou termine o turno.');
    }
    this.updateUI();
};

GraphWarGame.prototype.resolveFortification = function(sourceId, targetId, armiesToMove) {
    const source = this.territories.find(t => t.id === sourceId);
    const target = this.territories.find(t => t.id === targetId);

    if (source.armies < 2) {
        this.showMessage('Mínimo de 2 exércitos para mover.');
        // Não é mais necessário resetar aqui pois o modal já foi fechado
        return;
    }
    const maxMovable = source.armies - 1;

    // Verificar se o número de tropas é válido
    if (isNaN(armiesToMove) || armiesToMove <= 0 || armiesToMove > maxMovable) {
        this.showMessage('Número inválido de tropas. Fortificação cancelada.');
        this.fortifySource = null; this.selectedTerritory = null; this.updateUI();
        return;
    }

    source.armies -= armiesToMove;
    target.armies += armiesToMove;
    this.updateTerritoryDisplay(sourceId);
    this.updateTerritoryDisplay(targetId);
    this.updateGameStats();
    this.showMessage(`${armiesToMove} tropas movidas de ${source.name} para ${target.name}.`);
    this.addToBattleLog(`Fortificação: ${armiesToMove} de ${source.name} para ${target.name}.`);
    this.fortifySource = null;
    this.selectedTerritory = null;
    this.updateUI();
};

// Adicionar a função para mostrar o modal de fortificação
GraphWarGame.prototype.showFortifyModal = function(sourceId, targetId) {
    const source = this.territories.find(t => t.id === sourceId);
    const target = this.territories.find(t => t.id === targetId);

    if (!source || !target) return;

    const fortifyModal = document.getElementById('fortify-modal');
    const fortifySourceName = document.getElementById('fortify-source-name');
    const fortifyTargetName = document.getElementById('fortify-target-name');
    const fortifySourceArmies = document.getElementById('fortify-source-armies');
    const fortifyMaxMovable = document.getElementById('fortify-max-movable');
    const armiesToMoveInput = document.getElementById('armies-to-move-input');
    const confirmFortifyBtn = document.getElementById('confirm-fortify-btn');
    const cancelFortifyBtn = document.getElementById('cancel-fortify-btn');

    const maxMovable = source.armies - 1;
    if (maxMovable <= 0) {
        this.showMessage('Território de origem precisa de mais de 1 exército para fortificar.');
        this.fortifySource = null; this.selectedTerritory = null; this.updateUI();
        return;
    }

    fortifySourceName.textContent = source.name;
    fortifyTargetName.textContent = target.name;
    fortifySourceArmies.textContent = source.armies;
    fortifyMaxMovable.textContent = maxMovable;
    armiesToMoveInput.value = Math.max(1, Math.floor(maxMovable / 2)); // Valor padrão
    armiesToMoveInput.max = maxMovable;
    armiesToMoveInput.min = 1;

    fortifyModal.style.display = 'flex'; // Exibe o modal

    // Limpa listeners antigos para evitar duplicações
    confirmFortifyBtn.onclick = null;
    cancelFortifyBtn.onclick = null;

    // Adiciona listeners para os botões do modal
    confirmFortifyBtn.onclick = () => {
        const armies = parseInt(armiesToMoveInput.value);
        this.resolveFortification(sourceId, targetId, armies);
        fortifyModal.style.display = 'none'; // Esconde o modal
    };

    cancelFortifyBtn.onclick = () => {
        this.showMessage('Fortificação cancelada.');
        this.fortifySource = null; this.selectedTerritory = null; this.updateUI();
        fortifyModal.style.display = 'none'; // Esconde o modal
    };

    // Fechar ao clicar fora do modal
    fortifyModal.onclick = (event) => {
        if (event.target === fortifyModal) {
            this.showMessage('Fortificação cancelada.');
            this.fortifySource = null; this.selectedTerritory = null; this.updateUI();
            fortifyModal.style.display = 'none';
            fortifyModal.onclick = null; // Remove this specific listener to avoid interference
        }
    };
};

GraphWarGame.prototype.startPlayerTurn = function() {
    this.gamePhase = 'reinforcement';
    this.selectedTerritory = null; this.attackSource = null; this.fortifySource = null;

    const playerTerritoriesCount = this.territories.filter(t => t.owner === 'player').length;
    if (playerTerritoriesCount === 0 && this.currentTurn > 1) {
        this.checkGameEnd(); return; // Player lost
    }
    this.reinforcementsAvailable = Math.max(3, Math.floor(playerTerritoriesCount / 3));
    this.updateUI();
    this.showMessage(`Seu turno! ${this.reinforcementsAvailable} reforços disponíveis.`);
    this.addToBattleLog(`Turno ${this.currentTurn} - Fase de Reforço (Jogador)`);
};

GraphWarGame.prototype.endTurn = function() {
    if (this.currentPlayer !== 'player') return;
    this.currentTurn++;
    this.currentPlayer = 'ia';
    this.gamePhase = 'reinforcement'; // IA starts new turn with reinforcement
    this.selectedTerritory = null; this.attackSource = null; this.fortifySource = null;

    this.updateUI(); // Disable player buttons
    this.showMessage('Turno da IA...');
    this.addToBattleLog(`Fim do turno do Jogador. IA (Turno ${this.currentTurn}) jogando...`);
    setTimeout(() => this.executeIATurn(), 1000); // executeIATurn in GameAI.js
};
