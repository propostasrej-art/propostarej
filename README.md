# Propostarej

Crie uma aplicação web completa e profissional para Gestão de Propostas Imobiliárias, Análise de Documentos e Rateio Dinâmico de Comissões, chamada "Analista de Cadastro R&J".

### 1. Design System e Visual
- Estilo: "Equilíbrio Geométrico (Geometric Balance)".
- Paleta moderna e elegante: Slate claro (#f8fafc), cartões brancos com bordas suaves (border-slate-200), botões em Indigo (#4f46e5) e acentos em Emerald (#10b981) para valores financeiros.
- Tipografia: Sans-serif para a interface e Monospace para todos os valores monetários (R$), porcentagens, CPFs e datas de vencimento.
- Layout responsivo com barra lateral retrátil e navegação entre os 10 módulos.

### 2. Módulos e Funcionalidades Principais
1. Extração & Ficha da Proposta:
   - Formulário completo para cadastrar proposta: dados do empreendimento (unidade, torre, vaga, valor VGV), compradores (nome, CPF, RG, endereço, cônjuge), série de parcelas (Sinal/Ato, Mensais, Semestrais, Chaves, Financiamento Bancário, FGTS).
   - Validador que confere se a soma das parcelas bate 100% com o VGV.
   - Upload de arquivos e OCR simulado/real para autopreenchimento de dados da proposta.

2. Motor de Rateio em Cascata (O Core da Aplicação):
   - Configuração de comissão global (ex: 5% sobre VGV) e alíquotas para Corretor(es), Gerente, Diretor Comercial, Jurídico e Imobiliária.
   - Cálculo cronológico do passivo de comissão evento a evento (parcela a parcela).
   - Regras de retenção: Parcelas protegidas (Financiamento Bancário, FGTS, Subsídio) NÃO deduzem comissão. Parcelas de Sinal e Mensais têm percentuais de dedução configuráveis.
   - Capping dinâmico: Cada participante para de receber no momento exato em que seu teto nominal (VGV * % de comissão) é atingido.
   - Cascata de redistribuição: Os excedentes de participantes já quitados são canalizados para os participantes remanescentes até a liquidação total de comissão (garantindo soma zero).
   - Tabela de Credenciais dos Participantes na Venda (Rateio): Colunas Nome, Apelido, CPF/CNPJ, CRECI e Cargo na Operação com badges em pílula azul.
   - Diagnóstico do Especialista com memória de cálculo, parcelas de quitação e data de liberação de fluxo integral para o incorporador.
   - Exportações: CSV puro, arquivo de calendário .ics e impressão limpa formatada em A4 Paisagem.

3. Painel Dashboard:
   - Cards de métricas: VGV Total, Total de Comissões, Propostas em Análise, Propostas Aprovadas.
   - Gráficos de performance por empreendimento e por período.

4. Inbox de Propostas:
   - Lista de propostas salvas com busca, filtros de status (Em Análise, Aprovada, Escriturada), edição rápida e visualização.

5. Gestão de Empreendimentos:
   - Cadastro de condomínios/edifícios com endereço completo, construtora responsável, percentual padrão de honorários e regras personalizadas de retenção de comissão por tipo de parcela.

6. Equipe e Cargos:
   - Cadastro de corretores e gestores: Nome, Apelido, CPF/CNPJ, CRECI, telefone e função.

7. Ranking Comercial de Vendas:
   - Pódio dos 3 primeiros colocados com medalhas (ouro, prata, bronze).
   - Filtros de período (Hoje, Esta Semana, Este Mês, Trimestre, Ano, Personalizado).
   - Segmentação por Corretor, Gerente, Diretor ou Geral.
   - Modos de cálculo: VGV Integral vs VGV Proporcional.
   - Relatório de auditoria e performance pronto para impressão em A4.

8. Gerador de Contrato e Minutas Oficiais (A4):
   - Gerador do Contrato de Prestação de Serviços de Corretagem Imobiliária oficial (Lei 6.530/78 e Código Civil art. 728).
   - Incluir Tabela 1 (Condição de Pagamento da Proposta), Tabela 2 (Preço Líquido do Imóvel), Tabela 3 (Comissões), Tabela 4 (Cronograma de Rateio) e Tabela 5 (Credenciais dos Participantes na Venda).
   - Visualizador de impressão A4 com botões de download em PDF e impressão direta.

9. Assinatura Eletrônica (Assinafy) e Cobrança (Asaas):
   - Painel para acompanhar status de envelopes de assinatura eletrônica (Pendente, Assinado, Rejeitado, Não Encontrado) com botões para copiar link e enviar via WhatsApp.
   - Configuração de API Token e modo Sandbox de testes.

10. Webhooks e Controle de Acesso:
    - Tela de endpoint de webhook para receber propostas de CRMs externos e controle básico de usuários (Admin, Gerente, Corretor).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://propostarej.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d0608830-a950-4d01-a37a-7e238b659cae).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
