# Análise Federal · Assembleias Mycon (versão web para Vercel)

- `index.html`: interface (calendário, destaque de cotas, abas, card em PNG/HTML).
- `api/federal.js`: função que busca o resultado na Caixa pela data (`/api/federal?data=AAAA-MM-DD`).
- `vercel.json`: roda a função em São Paulo (gru1), para a Caixa aceitar as consultas.

## Publicar pela linha de comando
    npm i -g vercel
    cd analise-federal-vercel
    vercel            # 1ª vez: login + criar o projeto (aceite as opções padrão)
    vercel --prod     # publica no endereço definitivo

## Link direto
Dá para compartilhar já com data e cotas: `https://SEU-APP.vercel.app/?data=2026-11-11&cotas=623,663`

## Rodapé do card
Os valores padrão ficam em `CONFIG_PADRAO`, no início do script do `index.html`.
Cada pessoa também pode mudar em "Personalizar card" (fica salvo só no navegador dela).
