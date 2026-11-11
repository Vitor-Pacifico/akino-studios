# Akino Studios — agenda de tatuagem

React + Vite + Firebase Authentication + Cloud Firestore.

## Rodar
    npm install
    npm run dev      # desenvolvimento
    npm run build    # gera a pasta dist/ para publicar (Vercel, Netlify...)

## Conectar ao Firebase
1. Copie `.env.example` para `.env.local`.
2. No Firebase Console, abra **Configurações do projeto > Geral > Seus apps > akino-studios-web**.
3. Copie os valores correspondentes da configuração do SDK para `.env.local`.
4. Reinicie o servidor de desenvolvimento depois de salvar o arquivo.

Não publique nem compartilhe `.env.local`. O arquivo está ignorado pelo Git.

## Preparar a agenda
1. Inicie o site e abra **Área do estúdio**. Entre com o usuário criado no Firebase Authentication.
2. Copie o UID mostrado no painel.
3. Abra `firestore.rules`, substitua `REPLACE_WITH_OWNER_UID` pelo UID copiado e publique o conteúdo na aba **Firestore Database > Regras** no Firebase Console.
4. Publique as regras do arquivo `firestore.rules`. Os horários das 08:00 às 21:00 são gerados automaticamente; não é necessário cadastrar cada início.
5. Os bloqueios manuais e os intervalos ocupados são publicados sem dados pessoais na coleção `bloqueios`, que clientes podem ler. Apenas o UID do estúdio pode criar, alterar ou remover esses documentos. Ao abrir a área do estúdio, agendamentos confirmados antigos são copiados para essa coleção como intervalos anônimos.
6. As operações de agenda usam a coleção privada `scheduleDays` para serializar alterações do mesmo dia; as regras dessa coleção também precisam ser publicadas.

As regras deixam públicos somente os inícios disponíveis e o envio de pedidos; nome, telefone, pedidos e agenda ficam restritos ao UID do estúdio. Não publique regras mais permissivas.

## Fluxo
- O site gera inícios de hora em hora, das 08:00 às 21:00. Um início só aparece livre quando seu intervalo não conflita com um agendamento nem com um bloqueio manual.
- O estúdio pode bloquear um dia inteiro (08:00–22:00) ou um intervalo específico. Os antigos documentos em `availability` não são mais usados nem apagados.
- Clientes enviam um pedido para um início disponível. O pedido ainda não reserva o horário. Ao aprovar, o estúdio informa o término até as 22:00; a transação recusa conflitos e publica somente o intervalo ocupado, sem nome ou contato.
- O estúdio pode cadastrar atendimentos recebidos por fora do site e cancelar atendimentos existentes.
- Pedidos recusados ou horários cancelados não são apagados do histórico.

## Onde mexer
- `src/data.js`: estilos, locais, tamanhos e perguntas da ajuda.
- `src/components/Ajuda.jsx`: ajuda para quem não sabe o que fazer.
- `src/components/Formulario.jsx`: pedido de agendamento feito pelo cliente.
- `src/agenda.js`: operações e transações do Firestore.
- `src/horarios.js`: geração e verificação de conflitos entre intervalos.
- `firestore.rules`: regras de acesso; configure o UID do estúdio antes de publicar.
- `src/styles.css`: cores (variáveis em `:root`) e visual.
- `src/firebase.js`: inicialização do Firebase Authentication e Firestore.
