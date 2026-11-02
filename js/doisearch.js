
$(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════════
    // CONFIGURAÇÃO
    // ═══════════════════════════════════════════════════════════════

    // Cada filtro define:
    //   build: função que monta o parâmetro da API
    //   field: campo do item onde validar (para filtro client-side)
    //   strict: se true, exige que TODAS as palavras apareçam no campo
    const FILTERS = {
        doi: {
            build: v => `filter=doi:${encodeURIComponent(v)}`,
            field: 'DOI',
            strict: false,          // DOI é exato, sem filtro extra
            skipClientFilter: true
        },
        prefix: {
            build: v => `filter=prefix:${encodeURIComponent(v)}`,
            field: 'DOI',
            strict: false,
            skipClientFilter: true
        },
        title: {
            build: v => `query.title=${encodeURIComponent(v)}`,
            field: 'title',
            strict: true,           // todas as palavras no título
            minScore: 5
        },
        authors: {
            build: v => `query.author=${encodeURIComponent(v)}`,
            field: 'author',
            strict: false,          // basta 1 sobrenome bater
            minScore: 3
        },
        issn: {
            build: v => `filter=issn:${encodeURIComponent(v)}`,
            field: 'ISSN',
            strict: false,
            skipClientFilter: true
        },
        affiliation: {
            build: v => `query.affiliation=${encodeURIComponent(v)}`,
            field: 'affiliation',
            strict: false,
            minScore: 3
        },
        'publisher-name': {
            build: v => `query.publisher-name=${encodeURIComponent(v)}`,
            field: 'publisher',
            strict: false,
            minScore: 3
        }
    };

    const SORTS = {
        '0': 'sort=relevance',
        '1': 'sort=updated',
        '2': 'sort=deposited',
        '3': 'sort=published',
        '4': 'sort=issued',
        '5': 'sort=published-print',
        '6': 'sort=published-online'
    };

    const ORDERS = { '0': 'order=asc', '1': 'order=desc' };

    const CROSSREF_URL = 'https://api.crossref.org/works';

    // ═══════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════

    const escapeHtml = (str) =>
        String(str ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const normalize = (str) =>
        String(str ?? '')
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
            .replace(/[^\w\s]/g, ' ')                         // remove pontuação
            .replace(/\s+/g, ' ')
            .trim();

    const showStatus = (msg, type = 'warning') => {
        $('#status').html(
            `<div class="card card-body mt-2"><h2 class="text-${type} fw-bold">${escapeHtml(msg)}</h2></div>`
        );
        $('#loading').hide();
    };

    const showToast = (ok, msg) =>
        ok ? toastr.success(msg) : toastr.error(msg, 'Erro');

    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            showToast(true, 'Copiado para a área de transferência!');
        } catch (err) {
            console.error(err);
            showToast(false, 'Não foi possível copiar.');
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // FILTRAGEM CLIENT-SIDE (o coração da correção)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Extrai o texto de um campo do item, que pode ser string ou array.
     */
    function fieldText(item, field) {
        const val = item[field];
        if (val == null) return '';
        if (Array.isArray(val)) return val.join(' ');
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
    }

    /**
     * Verifica se o item corresponde ao termo buscado no campo configurado.
     */
    function matchesFilter(item, config, term) {
        if (config.skipClientFilter) return true;

        const words = normalize(term).split(' ').filter(w => w.length > 2);
        if (words.length === 0) return true;

        // ── Título ──────────────────────────────────────────────
        if (config.field === 'title') {
            const title = normalize(fieldText(item, 'title'));
            if (!title) return false;
            // Strict: TODAS as palavras devem estar no título
            return words.every(w => title.includes(w));
        }

        // ── Autores ─────────────────────────────────────────────
        if (config.field === 'author') {
            if (!Array.isArray(item.author)) return false;
            const names = item.author.map(a =>
                normalize(`${a.family || ''} ${a.given || ''} ${a.name || ''}`)
            );
            // Basta UM autor conter TODAS as palavras do termo
            // (ex.: "Silva João" → procura alguém com ambos no nome)
            return names.some(n => words.every(w => n.includes(w)));
        }

        // ── Afiliação ───────────────────────────────────────────
        if (config.field === 'affiliation') {
            if (!Array.isArray(item.author)) return false;
            const affs = item.author
                .flatMap(a => (a.affiliation || []).map(x => x.name || ''))
                .map(normalize);
            // Basta uma afiliação conter TODAS as palavras
            return affs.some(aff => words.every(w => aff.includes(w)));
        }

        // ── Publisher ───────────────────────────────────────────
        if (config.field === 'publisher') {
            const pub = normalize(fieldText(item, 'publisher'));
            return words.every(w => pub.includes(w));
        }

        // ── Genérico (fallback) ─────────────────────────────────
        const text = normalize(fieldText(item, config.field));
        return words.every(w => text.includes(w));
    }

    /**
     * Filtra e ordena os itens recebidos da API.
     * Retorna { validos, descartados }.
     */
    function refineResults(items, config, term) {
        const validos = [];
        const descartados = [];

        items.forEach(item => {
            // Filtra por tipo de publicação
            const isArticle = item.type === 'journal-article' || item.type === 'journal';
            if (!isArticle) { descartados.push(item); return; }

            // Filtra por correspondência no campo
            if (!matchesFilter(item, config, term)) {
                descartados.push(item);
                return;
            }

            // Filtra por score mínimo (se configurado e disponível)
            if (config.minScore && typeof item.score === 'number' && item.score < config.minScore) {
                descartados.push(item);
                return;
            }

            validos.push(item);
        });

        // Se NADA passou no filtro rigoroso, relaxa: usa os originais
        // (evita tela vazia quando o termo é muito específico)
        if (validos.length === 0 && descartados.length > 0) {
            console.warn('[refineResults] Filtro rigoroso não retornou nada, relaxando...');
            // Fallback: mantém apenas artigos com score razoável
            const fallback = descartados
                .filter(i => (i.type === 'journal-article' || i.type === 'journal'))
                .filter(i => !config.minScore || (i.score || 0) >= config.minScore / 2)
                .sort((a, b) => (b.score || 0) - (a.score || 0));
            return { validos: fallback, descartados: [], relaxed: true };
        }

        return { validos, descartados, relaxed: false };
    }

    // ═══════════════════════════════════════════════════════════════
    // FORMATAÇÃO DE AUTORES
    // ═══════════════════════════════════════════════════════════════

    function formatAuthors(authors, { badge = false, htmlBr = false, etalLimit = null } = {}) {
        if (!Array.isArray(authors) || authors.length === 0) return '';
        let out = badge ? `<span class="badge text-bg-success mr-2">${authors.length}</span> ` : '';
        const list = etalLimit && authors.length > etalLimit
            ? authors.slice(0, etalLimit)
            : authors;

        out += list.map(a =>
            `${escapeHtml(a.family || a.name || '')}, ${escapeHtml(a.given || '')}`
        ).join('; ');
        if (etalLimit && authors.length > etalLimit) out += ' <em>et al.</em>';
        if (htmlBr) out += '<br/>';
        return out;
    }

    // ═══════════════════════════════════════════════════════════════
    // RENDERIZAÇÃO DE UM REGISTRO
    // ═══════════════════════════════════════════════════════════════

    function renderItem(item, index) {
        const title = Array.isArray(item.title) ? item.title[0] : item.title;
        const container = Array.isArray(item['container-title']) ? item['container-title'][0] : item['container-title'];
        const shortContainer = Array.isArray(item['short-container-title']) ? item['short-container-title'][0] : item['short-container-title'];
        const issn = Array.isArray(item.ISSN) ? item.ISSN[0] : item.ISSN;
        const id = index + 1;
        const refId = 'ref_' + id;

        let html = `<span class="badge text-bg-primary mr-2">${id}</span> `;
        html += `<span class="fw-bold ml-3">Título: </span>${escapeHtml(title)}<br/>`;
        html += `<span class="fw-bold ml-3">Autores: </span>${formatAuthors(item.author, { badge: true, htmlBr: true })}`;
        html += `<span class="fw-bold ml-3">Revista: </span>${escapeHtml(container)}<br/>`;
        if (issn) html += `<span class="fw-bold ml-3">ISSN: </span>${escapeHtml(issn)}<br/>`;
        html += `<span class="fw-bold ml-3">Abreviação da Revista: </span>${escapeHtml(shortContainer)}<br/>`;

        if (item.issue) {
            html += `<span class="fw-bold ml-3">Volume e Número: </span>v.${escapeHtml(item.volume)}.i${escapeHtml(item.issue)}<br/>`;
        } else {
            html += `<span class="fw-bold ml-3">Volume: </span>v.${escapeHtml(item.volume)}<br/>`;
        }
        html += `<span class="fw-bold ml-3">Páginas/e-location: </span>${escapeHtml(item.page)}<br/>`;
        html += `<span class="fw-bold ml-3">Tipo de Publicação: </span>${escapeHtml(item.type)}<br/>`;
        html += `<span class="fw-bold ml-3">Publisher: </span>${escapeHtml(item.publisher)}<br/>`;
        html += `<span class="fw-bold ml-3">DOI: </span>${escapeHtml(item.DOI)}<br/>`;

        // URL DOI + botão copiar
        html += `<span class="fw-bold ml-3">URL DOI: </span>` +
                `<a class="mr-2 pr-2" href="${escapeHtml(item.URL)}" target="_blank" rel="noopener">${escapeHtml(item.URL)}</a>` +
                `<button type="button" class="btndoi btn btn-sm btn-outline-success pl-5" data-clipboard="${escapeHtml(item.DOI)}" aria-label="Copiar DOI">Copiar DOI</button><br/>`;

        // URL direta (protegida)
        const directUrl = item.resource?.primary?.URL;
        if (directUrl) {
            html += `<span class="fw-bold ml-3">URL Direta: </span><a href="${escapeHtml(directUrl)}" target="_blank" rel="noopener">${escapeHtml(directUrl)}</a><br/>`;
        }

        // Abstract
        html += `<div class="d-block"><a class="btn btn-primary" data-bs-toggle="collapse" href="#collapse${id}" role="button" aria-expanded="false" aria-controls="collapse${id}">Abstract</a></div>`;
        html += `<div class="collapse" id="collapse${id}"><div class="card card-body">${item.abstract ?? '<em>Sem abstract.</em>'}</div></div>`;

        // Data de depósito
        const ts = item.created?.timestamp;
        if (ts) {
            html += `<span class="fw-bold ml-3">Data do Depósito: </span>${new Date(ts).toLocaleDateString('pt-BR')}<br/>`;
        }

        // Referência APA
        if ($('#checkRef').is(':checked')) {
            const year = item.published?.['date-parts']?.[0]?.[0] ?? '';
            let ref = `${formatAuthors(item.author, { etalLimit: 10 })} (${year}). ${escapeHtml(title)}. <em>${escapeHtml(container)}</em>, ${escapeHtml(item.volume)}`;
            if (item.issue) ref += `(${escapeHtml(item.issue)})`;
            if (item.page) ref += `: ${escapeHtml(item.page)}`;
            ref += `. doi: ${escapeHtml(item.DOI)}`;

            html += `<span class="fw-bold ml-3">Referência (modelo APA): </span><br/>`;
            html += `<span id="${refId}">${ref}</span><br/>`;
            html += `<button type="button" class="btnRef btn btn-sm btn-outline-primary pl-5" data-clipboard-target="${refId}" aria-label="Copiar referência">Copiar Referência</button>`;
        }

        html += `<hr class="w-100 text-danger bg-danger rounded" style="height:5px"/>`;
        return html;
    }

    // ═══════════════════════════════════════════════════════════════
    // BUSCA PRINCIPAL
    // ═══════════════════════════════════════════════════════════════

    function search() {
        try {
            const rawValue = $('#strDOI').val().trim();
            if (!rawValue) return showStatus('Um valor DEVE ser informado!');

            const opt = $('#DOIOption').val();
            const config = FILTERS[opt];
            if (!config) return showStatus('Uma opção deve ser selecionada!');

            const sortParam = SORTS[$('#ddlOrder').val()];
            const orderVal = $('input[name="rbOrder"]:checked').val();
            const orderParam = ORDERS[orderVal];
            if (!orderParam) return showStatus('Uma opção de ordenamento deve ser selecionada!');

            const rows = $('#ddlRows').val();

            const params = [
                `rows=${encodeURIComponent(rows)}`,
                config.build(rawValue),
                sortParam,
                orderParam
            ].join('&');

            const url = `${CROSSREF_URL}?${params}`;
            console.log('[Crossref] URL:', url);

            // Reset UI
            $('#status, #dois, #count').empty();
            $('#loading').show();

            $.ajax({
                type: 'GET',
                dataType: 'json',
                url,
                success(data) {
                    try {
                        const items = data?.message?.items ?? [];
                        console.log(`[Crossref] ${items.length} itens recebidos da API`);

                        // ── FILTRAGEM CLIENT-SIDE ──────────────────
                        const { validos, descartados, relaxed } =
                            refineResults(items, config, rawValue);

                        console.log(`[Crossref] ${validos.length} válidos, ${descartados.length} descartados${relaxed ? ' (relaxado)' : ''}`);

                        if (validos.length === 0) {
                            showStatus(
                                `Nenhum resultado relevante encontrado para "${rawValue}". ` +
                                `A API retornou ${items.length} item(s), mas nenhum corresponde ao filtro de ${opt}.`,
                                'warning'
                            );
                            $('#count').empty();
                            return;
                        }

                        const html = validos.map(renderItem).join('');
                        $('#dois').html(
                            '<hr class="w-100 text-primary rounded" style="height:5px;"/>' + html
                        );

                        // Contador com detalhes
                        let countHtml = `<h4 class="m-3 p-3 bg-light">` +
                            `Exibindo <span class="badge text-bg-danger">${validos.length}</span> ` +
                            `de <span class="badge text-bg-secondary">${items.length}</span> ` +
                            `registro(s) retornado(s) pela API`;
                        if (descartados.length > 0) {
                            countHtml += ` <small class="text-muted">(${descartados.length} descartado(s) por não corresponder ao filtro)</small>`;
                        }
                        if (relaxed) {
                            countHtml += ` <span class="badge text-bg-warning">filtro relaxado</span>`;
                        }
                        countHtml += `</h4>`;
                        $('#count').html(countHtml);

                    } catch (err) {
                        console.error(err);
                        showStatus('Erro ao processar os resultados: ' + err.message, 'danger');
                    } finally {
                        $('#loading').hide();
                    }
                },
                error(xhr) {
                    console.error('[Crossref] Erro:', xhr.status, xhr.responseText);
                    showStatus(
                        'Erro ao carregar os DOIs! Verifique os dados informados e sua conexão.',
                        'warning'
                    );
                    $('#dois').empty();
                    $('#loading').hide();
                }
            });
        } catch (err) {
            showStatus(err.message, 'danger');
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // EVENTOS
    // ═══════════════════════════════════════════════════════════════

    $('#btnSearch').on('click', search);

    // Enter com debounce
    let enterTimer;
    $('#strDOI')
        .on('keyup', function (e) {
            if (e.which === 13) {
                clearTimeout(enterTimer);
                enterTimer = setTimeout(search, 150);
            }
        })
        .on('focus', function () { $(this).select(); });

    // Delegação única para botões de cópia
    $('#dois').on('click', '.btndoi, .btnRef', function () {
        const btn = $(this);
        const text = btn.data('clipboard')
            ?? $('#' + btn.data('clipboard-target')).text();
        copyToClipboard(String(text).trim());
    });

    // Init
    $('#loading, #count, #status').empty();
    if (typeof AppInfo === 'function') AppInfo();
});
