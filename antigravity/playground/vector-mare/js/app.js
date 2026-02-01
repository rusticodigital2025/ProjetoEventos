/** 
 * Cerimonialista - Gestão Minimalista
 * Versão 2.2 - Reaplicada com Correções de Sintaxe
 */

const DB_NAME = 'cerimonial_db';

const DEFAULT_CONTRACT_TEMPLATE = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE CERIMONIAL

CONTRATADA: [Seu Nome ou Empresa], CPF/CNPJ: [Seu Documento], residente e domiciliada em [Seu Endereço].

CONTRATANTE: [Nome do Cliente], CPF: [Documento do Cliente], residente e domiciliado em [Endereço do Cliente].

OBJETO: O presente contrato tem por objeto a prestação de serviços de cerimonial e assessoria para o evento [Nome do Evento], a realizar-se no dia [Data] às [Hora].

CLÁUSULA 1ª - DOS SERVIÇOS: A CONTRATADA compromete-se a realizar o planejamento, coordenação e execução do cerimonial no dia do evento.

CLÁUSULA 2ª - DOS HONORÁRIOS: Pela prestação dos serviços, o CONTRATANTE pagará à CONTRATADA o valor de R$ [Valor], da seguinte forma: [Forma de Pagamento].

CLÁUSULA 3ª - DA RESCISÃO: O presente contrato poderá ser rescindido por ambas as partes com aviso prévio de 30 dias.

Foro: As partes elegem o foro de [Sua Cidade] para dirimir quaisquer dúvidas oriundas deste contrato.

[Sua Cidade], [Data de Hoje]

__________________________________________
CONTRATADA

__________________________________________
CONTRATANTE`;

/** Sistema de Autenticação e Hashing **/
const auth = {
    currentUser: null,

    init: function () {
        const saved = localStorage.getItem(DB_NAME + '_session');
        if (saved) {
            this.currentUser = JSON.parse(saved);
            return true;
        }
        return false;
    },

    async hashPassword(password) {
        const msgUint8 = new TextEncoder().encode(password + "cerimonial_salt");
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    async signup(email, password, name) {
        const users = storage._getRaw('users');
        if (users.find(u => u.email === email)) {
            throw new Error('Email já cadastrado.');
        }
        const hashedPassword = await this.hashPassword(password);
        const newUser = { id: Date.now().toString(), email, password: hashedPassword, name };
        users.push(newUser);
        storage._saveRaw('users', users);
        return this.login(email, password);
    },

    async login(email, password) {
        const users = storage._getRaw('users');
        const hashedPassword = await this.hashPassword(password);
        const user = users.find(u => u.email === email && u.password === hashedPassword);
        if (user) {
            this.currentUser = { id: user.id, email: user.email, name: user.name };
            localStorage.setItem(DB_NAME + '_session', JSON.stringify(this.currentUser));
            return true;
        }
        throw new Error('Email ou senha inválidos.');
    },

    logout: function () {
        this.currentUser = null;
        localStorage.removeItem(DB_NAME + '_session');
        location.reload();
    }
};

/** Camada de Dados com Isolamento **/
const storage = {
    _getRaw: function (key) {
        try {
            const data = localStorage.getItem(DB_NAME + '_' + key);
            return data ? JSON.parse(data) : [];
        } catch (e) { return []; }
    },

    _saveRaw: function (key, items) {
        try {
            localStorage.setItem(DB_NAME + '_' + key, JSON.stringify(items));
        } catch (e) { alert('Erro ao salvar no navegador.'); }
    },

    get: function (key) {
        if (!auth.currentUser) return [];
        const allItems = this._getRaw(key);
        return allItems.filter(i => i.userId === auth.currentUser.id);
    },

    save: function (key, items) {
        if (!auth.currentUser) return;
        const allItems = this._getRaw(key).filter(i => i.userId !== auth.currentUser.id);
        const userItems = items.map(i => {
            if (!i.userId) i.userId = auth.currentUser.id;
            return i;
        });
        this._saveRaw(key, [...allItems, ...userItems]);
    },

    add: function (key, item) {
        const items = this.get(key);
        item.id = Date.now().toString();
        item.userId = auth.currentUser.id;
        item.createdAt = new Date().toISOString();
        items.push(item);
        this.save(key, items);
        return item;
    },

    update: function (key, id, updates) {
        const items = this.get(key);
        let found = false;
        for (let i = 0; i < items.length; i++) {
            if (items[i].id === id) {
                for (let prop in updates) {
                    items[i][prop] = updates[prop];
                }
                items[i].updatedAt = new Date().toISOString();
                found = true;
                break;
            }
        }
        if (found) this.save(key, items);
        return found;
    },

    delete: function (key, id) {
        const items = this.get(key);
        const filtered = items.filter(function (i) { return i.id !== id; });
        this.save(key, filtered);
    },

    getById: function (key, id) {
        const items = this.get(key);
        for (let i = 0; i < items.length; i++) {
            if (items[i].id === id) return items[i];
        }
        return null;
    }
};

/** Auxiliar de Formulário **/
function extractFormData(form) {
    const data = {};
    const elements = form.elements;
    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (el.name) {
            if (el.type === 'select-multiple') {
                const values = [];
                for (let j = 0; j < el.options.length; j++) {
                    if (el.options[j].selected) values.push(el.options[j].value);
                }
                data[el.name] = values;
            } else if (el.type === 'checkbox') {
                if (el.checked) {
                    if (!data[el.name]) data[el.name] = [];
                    if (Array.isArray(data[el.name])) {
                        data[el.name].push(el.value);
                    } else {
                        data[el.name] = [el.value];
                    }
                }
            } else {
                data[el.name] = el.value;
            }
        }
    }
    return data;
}

/** Componentes UI Reutilizáveis **/
const ui = {
    renderGauge: function (percent, size) {
        size = size || 40;
        const radius = (size / 2) - 4;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percent / 100) * circumference;

        return `
            <div class="gauge-chart" style="width: ${size}px; height: ${size}px">
                <svg width="${size}" height="${size}">
                    <circle class="gauge-bg" cx="${size / 2}" cy="${size / 2}" r="${radius}"></circle>
                    <circle class="gauge-fill" cx="${size / 2}" cy="${size / 2}" r="${radius}" 
                            style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset};"></circle>
                </svg>
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: ${size / 4}px; font-weight: 700; color: var(--text-main)">
                    ${percent}%
                </div>
            </div>
        `;
    },

    renderReportHeader: function (title, subtitle) {
        const logo = localStorage.getItem(DB_NAME + '_logo_' + (auth.currentUser ? auth.currentUser.id : 'default'));
        const brandLabel = localStorage.getItem(DB_NAME + '_brand_label_' + (auth.currentUser ? auth.currentUser.id : 'default')) || 'Cerimonial';
        return `
            <div class="report-header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid var(--text-main); padding-bottom: 1rem; margin-bottom: 2rem">
                <div>
                    <h1 style="font-family: var(--font-serif); font-size: 2rem; margin: 0">${title}</h1>
                    ${subtitle ? `<h2 style="font-size: 1.25rem; color: var(--text-muted); margin: 0.5rem 0 0">${subtitle}</h2>` : ''}
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0.5rem 0 0">Gerado em: ${new Date().toLocaleDateString('pt-BR')}</p>
                </div>
                <div style="text-align: right">
                    ${logo ? `<img src="${logo}" style="height: 60px; margin-bottom: 0.5rem">` : ''}
                    <div style="font-weight: 700; font-family: var(--font-serif)">${brandLabel}</div>
                </div>
            </div>
        `;
    }
};

/** Instância Principal da Aplicação **/
const application = {
    view: 'dashboard',
    searchQuery: '',

    init: function () {
        auth.init();
        if (auth.currentUser) {
            this.loadBranding();
            this.render();
            this.updateDate();
        } else {
            this.view = 'login';
            this.render();
        }
    },

    loadBranding: function () {
        if (!auth.currentUser) return;
        const userId = auth.currentUser.id;
        const logo = localStorage.getItem(DB_NAME + '_logo_' + userId);
        const brandLabel = localStorage.getItem(DB_NAME + '_brand_label_' + userId) || 'Cerimonial';
        const primaryColor = localStorage.getItem(DB_NAME + '_primary_color_' + userId);

        if (primaryColor) {
            document.documentElement.style.setProperty('--primary-color', primaryColor);
            document.documentElement.style.setProperty('--primary-hover', primaryColor);
        }

        const brandingDiv = document.getElementById('branding');
        if (brandingDiv) {
            brandingDiv.innerHTML = `
                ${logo ? `<img src="${logo}" style="height: 50px; border-radius: 8px">` : ''}
                <div class="brand">${brandLabel}</div>
            `;
        }
    },

    processImage: function (file, callback, maxWidth, maxHeight) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                callback(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    navigate: function (viewName) {
        this.view = viewName;
        this.searchQuery = ''; // Limpa a busca ao navegar
        const searchInput = document.getElementById('global-search');
        if (searchInput) searchInput.value = '';

        // Esconde sidebar no mobile após navegar
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.classList.remove('active');

        // Atualiza UI da Navegação
        const navs = document.querySelectorAll('.nav-item');
        for (let i = 0; i < navs.length; i++) {
            const isMatch = navs[i].getAttribute('data-view') === viewName;
            navs[i].classList.toggle('active', isMatch);
        }
        // Adiciona classe de animação para a troca de view
        const container = document.getElementById('view-container');
        if (container) {
            container.classList.remove('fade-in');
            void container.offsetWidth; // Trigger reflow
            container.classList.add('fade-in');
        }

        this.render();
    },

    updateDate: function () {
        const d = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('current-date').textContent = d.toLocaleDateString('pt-BR', options);
    },

    render: function () {
        const container = document.getElementById('view-container');
        const title = document.getElementById('view-title');
        const searchContainer = document.getElementById('search-container');
        const sidebar = document.querySelector('.sidebar');
        const topBar = document.querySelector('.top-bar');

        if (!auth.currentUser && this.view !== 'signup' && this.view !== 'login') {
            this.view = 'login';
        }

        // Mostrar/Ocultar elementos baseado na autenticação
        if (sidebar) sidebar.style.display = auth.currentUser ? 'flex' : 'none';
        if (topBar) topBar.style.display = auth.currentUser ? 'flex' : 'none';
        if (!auth.currentUser) {
            document.getElementById('app').style.display = 'block'; // Layout centralizado para login
        } else {
            document.getElementById('app').style.display = 'flex';
        }

        const data = {
            clients: storage.get('clients'),
            events: storage.get('events'),
            vendors: storage.get('vendors')
        };

        // Mostrar/Ocultar busca se necessário
        const searchableViews = ['clients', 'events', 'vendors'];
        if (searchContainer) {
            searchContainer.style.display = searchableViews.indexOf(this.view) !== -1 ? 'block' : 'none';
        }

        // Aplicar Filtragem se houver busca
        const q = this.searchQuery.toLowerCase();
        if (q) {
            data.clients = data.clients.filter(function (c) {
                return c.name.toLowerCase().indexOf(q) !== -1 || c.email.toLowerCase().indexOf(q) !== -1;
            });
            data.events = data.events.filter(function (e) {
                return e.title.toLowerCase().indexOf(q) !== -1 || e.clientName.toLowerCase().indexOf(q) !== -1;
            });
            data.vendors = data.vendors.filter(function (v) {
                return v.name.toLowerCase().indexOf(q) !== -1 || v.category.toLowerCase().indexOf(q) !== -1;
            });
        }

        switch (this.view) {
            case 'dashboard':
                title.textContent = 'Painel Geral';
                container.innerHTML = this.views.dashboard(data);
                break;
            case 'clients':
                title.textContent = 'Clientes';
                container.innerHTML = this.views.clients(data.clients);
                break;
            case 'events':
                title.textContent = 'Eventos';
                container.innerHTML = this.views.events(data.events, data.clients);
                break;
            case 'vendors':
                title.textContent = 'Fornecedores';
                container.innerHTML = this.views.vendors(data.vendors);
                break;
            case 'reports':
                title.textContent = 'Relatórios';
                container.innerHTML = this.views.reports();
                break;
            case 'settings':
                title.textContent = 'Configurações';
                container.innerHTML = this.views.settings();
                break;
            case 'login':
                container.innerHTML = this.views.login();
                break;
            case 'signup':
                container.innerHTML = this.views.signup();
                break;
            case 'clientDetails':
                // Título definido no openClientDetails
                break;
            case 'checklist':
                // Título definido no openChecklist
                break;
            default:
                container.innerHTML = '<h2>Página não encontrada</h2>';
        }
    },

    saveSettings: function (form) {
        if (!auth.currentUser) return;
        const userId = auth.currentUser.id;
        const logoInput = form.querySelector('input[name="logo"]');
        const brandName = form.querySelector('input[name="brandName"]').value;
        const primaryColor = form.querySelector('input[name="primaryColor"]').value;

        localStorage.setItem(DB_NAME + '_brand_label_' + userId, brandName);
        localStorage.setItem(DB_NAME + '_primary_color_' + userId, primaryColor);

        if (logoInput.files && logoInput.files[0]) {
            this.processImage(logoInput.files[0], (base64) => {
                localStorage.setItem(DB_NAME + '_logo_' + userId, base64);
                this.loadBranding();
                alert('Configurações salvas com sucesso!');
                this.navigate('dashboard');
            }, 200, 200);
        } else {
            this.loadBranding();
            alert('Configurações atualizadas!');
            this.navigate('dashboard');
        }
    },

    /** Ações CRUD **/
    saveClient: function (form) {
        const data = extractFormData(form);
        const id = data.id;
        delete data.id;
        if (id) {
            storage.update('clients', id, data);
        } else {
            storage.add('clients', data);
        }
        this.navigate('clients');
    },

    saveEvent: function (form) {
        const data = extractFormData(form);
        const id = data.id;
        const status = data.status || 'Agendado';
        delete data.id;
        delete data.status;

        const client = storage.getById('clients', data.clientId);
        data.clientName = client ? client.name : 'N/D';
        data.status = status;

        if (id) {
            storage.update('events', id, data);
        } else {
            storage.add('events', data);
        }
        this.navigate('events');
    },

    finalizeEvent: function (id) {
        if (confirm('Marcar este evento como Finalizado com Sucesso?')) {
            storage.update('events', id, { status: 'Finalizado' });
            this.render();
        }
    },

    saveVendor: function (form) {
        const data = extractFormData(form);
        const id = data.id;
        delete data.id;
        if (id) {
            storage.update('vendors', id, data);
        } else {
            storage.add('vendors', data);
        }
        this.navigate('vendors');
    },

    toggleSidebar: function () {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.toggle('active');
        }
    },

    deleteItem: function (key, id, label) {
        if (confirm('Deseja realmente excluir este ' + label + '?')) {
            storage.delete(key, id);
            this.render();
        }
    },

    /** Detalhes do Cliente **/
    openClientDetails: function (id) {
        const client = storage.getById('clients', id);
        this.view = 'clientDetails';
        const allEvents = storage.get('events');
        const clientEvents = allEvents.filter(function (e) { return e.clientId === id; });

        document.getElementById('view-title').textContent = 'Ficha do Cliente: ' + client.name;
        document.getElementById('view-container').innerHTML = this.views.clientDetails(client, clientEvents);
    },

    /** Auth UI Actions **/
    handleLogin: async function (form) {
        const data = extractFormData(form);
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        try {
            submitBtn.innerHTML = 'Acessando...';
            submitBtn.disabled = true;

            await auth.login(data.email, data.password);

            // Força reinicialização da interface com o novo estado de auth
            this.init();
            this.navigate('dashboard');
        } catch (e) {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            alert(e.message);
        }
    },

    handleSignup: async function (form) {
        const data = extractFormData(form);
        const submitBtn = form.querySelector('button[type="submit"]');

        try {
            submitBtn.innerHTML = 'Criando Conta...';
            submitBtn.disabled = true;

            await auth.signup(data.email, data.password, data.name);
            this.init();
            this.navigate('dashboard');
        } catch (e) {
            submitBtn.innerHTML = 'Criar Conta Premium';
            submitBtn.disabled = false;
            alert(e.message);
        }
    },
    /** Contract Management **/
    openContractEditor: function (id) {
        const client = storage.getById('clients', id);
        this.view = 'contractEditor';
        const contractText = client.contract || DEFAULT_CONTRACT_TEMPLATE
            .replace('[Nome do Cliente]', client.name)
            .replace('[Data de Hoje]', new Date().toLocaleDateString('pt-BR'));

        document.getElementById('view-title').textContent = 'Contrato: ' + client.name;
        document.getElementById('view-container').innerHTML = this.views.contractEditor(client, contractText);
    },

    saveContract: function (id, form) {
        const data = extractFormData(form);
        storage.update('clients', id, { contract: data.contractText });
        this.openClientDetails(id);
    },

    printContract: function (id) {
        const container = document.getElementById('view-container');
        const original = container.innerHTML;
        const client = storage.getById('clients', id);
        container.innerHTML = this.views.contractReport(client.contract || 'Contrato não preenchido.');
        window.print();
        container.innerHTML = original;
    },

    /** Checklist Logic **/
    openChecklist: function (id) {
        const event = storage.getById('events', id);
        this.view = 'checklist';
        document.getElementById('view-title').textContent = 'Checklist: ' + event.title;
        document.getElementById('view-container').innerHTML = this.views.checklist(event);
    },

    addChecklistItem: function (eventId, form) {
        const data = extractFormData(form);
        const event = storage.getById('events', eventId);
        if (!event.checklist) event.checklist = [];
        event.checklist.push({
            id: Date.now().toString(),
            text: data.text,
            completed: false
        });
        storage.update('events', eventId, { checklist: event.checklist });
        this.openChecklist(eventId);
    },

    toggleChecklistItem: function (eventId, itemId) {
        const event = storage.getById('events', eventId);
        for (let i = 0; i < event.checklist.length; i++) {
            if (event.checklist[i].id === itemId) {
                event.checklist[i].completed = !event.checklist[i].completed;
                break;
            }
        }
        storage.update('events', eventId, { checklist: event.checklist });
        this.openChecklist(eventId);
    },

    deleteChecklistItem: function (eventId, itemId) {
        const event = storage.getById('events', eventId);
        event.checklist = event.checklist.filter(function (i) { return i.id !== itemId; });
        storage.update('events', eventId, { checklist: event.checklist });
        this.openChecklist(eventId);
    },


    triggerPhotoUpload: function (eventId) {
        let input = document.getElementById('global-photo-upload');
        if (!input) {
            input = document.createElement('input');
            input.type = 'file';
            input.id = 'global-photo-upload';
            input.style.display = 'none';
            input.accept = 'image/*';
            document.body.appendChild(input);
        }
        input.onchange = (e) => this.addEventPhoto(eventId, e.target);
        input.click();
    },

    /** Form Opening **/
    openForm: function (type) {
        const container = document.getElementById('view-container');
        const title = document.getElementById('view-title');
        if (type === 'client') {
            title.textContent = 'Novo Cliente';
            container.innerHTML = this.views.clientForm();
        } else if (type === 'event') {
            title.textContent = 'Novo Evento';
            container.innerHTML = this.views.eventForm(storage.get('clients'));
        } else if (type === 'vendor') {
            title.textContent = 'Novo Fornecedor';
            container.innerHTML = this.views.vendorForm();
        }
    },

    editClient: function (id) {
        const client = storage.getById('clients', id);
        document.getElementById('view-title').textContent = 'Editar Cliente';
        document.getElementById('view-container').innerHTML = this.views.clientForm(client);
    },

    editEvent: function (id) {
        const event = storage.getById('events', id);
        const clients = storage.get('clients');
        document.getElementById('view-title').textContent = 'Editar Evento';
        document.getElementById('view-container').innerHTML = this.views.eventForm(clients, event);
    },

    editVendor: function (id) {
        const vendor = storage.getById('vendors', id);
        document.getElementById('view-title').textContent = 'Editar Fornecedor';
        document.getElementById('view-container').innerHTML = this.views.vendorForm(vendor);
    },

    openVendorProducts: function (id) {
        const vendor = storage.getById('vendors', id);
        this.view = 'vendorProducts';
        document.getElementById('view-title').textContent = 'Produtos: ' + vendor.name;
        document.getElementById('view-container').innerHTML = this.views.vendorProducts(vendor);
    },

    addVendorProduct: function (vendorId, form) {
        const data = extractFormData(form);
        const vendor = storage.getById('vendors', vendorId);
        if (!vendor.products) vendor.products = [];
        const quantity = parseFloat(data.quantity) || 1;
        const price = parseFloat(data.price) || 0;
        vendor.products.push({
            id: Date.now().toString(),
            name: data.name,
            quantity: quantity,
            price: price,
            total: quantity * price
        });
        storage.update('vendors', vendorId, { products: vendor.products });
        this.openVendorProducts(vendorId);
    },

    deleteVendorProduct: function (vendorId, productId) {
        const vendor = storage.getById('vendors', vendorId);
        vendor.products = vendor.products.filter(function (p) { return p.id !== productId; });
        storage.update('vendors', vendorId, { products: vendor.products });
        this.openVendorProducts(vendorId);
    },

    calculateEventTotal: function (form) {
        const guests = parseFloat(form.guestCount.value) || 0;
        const valueP = parseFloat(form.valuePerGuest.value) || 0;
        form.totalValue.value = (guests * valueP).toFixed(2);
    },

    calculateProductTotal: function (form) {
        const qt = parseFloat(form.quantity.value) || 0;
        const pr = parseFloat(form.price.value) || 0;
        form.totalProductValue.value = (qt * pr).toFixed(2);
    },

    printReport: function (type) {
        const container = document.getElementById('view-container');
        const original = container.innerHTML;
        if (type === 'clients') {
            container.innerHTML = this.views.clientReport(storage.get('clients'));
        } else if (type === 'events') {
            container.innerHTML = this.views.eventReport(storage.get('events'));
        } else if (type === 'completed_events') {
            const completed = storage.get('events').filter(e => e.status === 'Finalizado');
            container.innerHTML = this.views.eventReport(completed);
        }
        window.print();
        container.innerHTML = original;
    },

    printIndividualReport: function (type, id) {
        const container = document.getElementById('view-container');
        const original = container.innerHTML;

        if (type === 'client') {
            const client = storage.getById('clients', id);
            const events = storage.get('events').filter(function (e) { return e.clientId === id; });
            container.innerHTML = this.views.individualClientReport(client, events);
        } else if (type === 'event') {
            const event = storage.getById('events', id);
            container.innerHTML = this.views.individualEventReport(event);
        }

        window.print();
        container.innerHTML = original;
    },

    /** Templates de Visualização **/
    views: {
        dashboard: function (data) {
            const scheduled = data.events.filter(function (e) { return e.status !== 'Finalizado'; });

            // Cálculo de progresso médio
            let totalTasks = 0, doneTasks = 0;
            data.events.forEach(function (e) {
                if (e.checklist) {
                    totalTasks += e.checklist.length;
                    doneTasks += e.checklist.filter(function (i) { return i.completed; }).length;
                }
            });
            const avgProgress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

            return `
                <div class="grid">
                    <div class="card" style="display: flex; align-items: center; justify-content: space-between">
                        <div>
                            <h3 style="color: var(--text-muted); font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em">Clientes Ativos</h3>
                            <p style="font-size: 2.5rem; font-weight: 800; margin-top: 0.5rem">${data.clients.length}</p>
                        </div>
                        <div style="background: rgba(197, 160, 89, 0.1); padding: 1rem; border-radius: 12px; color: var(--primary-color)">👥</div>
                    </div>
                    <div class="card" style="display: flex; align-items: center; justify-content: space-between">
                        <div>
                            <h3 style="color: var(--text-muted); font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em">Eventos na Agenda</h3>
                            <p style="font-size: 2.5rem; font-weight: 800; margin-top: 0.5rem">${scheduled.length}</p>
                        </div>
                        <div style="background: rgba(132, 158, 113, 0.1); padding: 1rem; border-radius: 12px; color: var(--accent-success)">📅</div>
                    </div>
                    <div class="card" style="display: flex; align-items: center; justify-content: space-between">
                        <div>
                            <h3 style="color: var(--text-muted); font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em">Progresso Geral</h3>
                            <div style="margin-top: 1rem">${ui.renderGauge(avgProgress, 60)}</div>
                        </div>
                    </div>
                </div>
                
                <div style="margin-top: 3rem">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem">
                        <h3 style="font-family: var(--font-serif); font-size: 1.25rem">Próximos Compromissos</h3>
                        <button class="btn" onclick="application.navigate('events')" style="font-size: 0.75rem">Ver Agenda Completa →</button>
                    </div>
                    <div class="card" style="padding: 0; overflow: hidden">
                        <div class="table-responsive">
                            <table class="simple-table">
                                <thead><tr><th>Data/Hora</th><th>Evento</th><th>Cliente</th><th>Progresso</th></tr></thead>
                                <tbody>
                                    ${scheduled.slice(0, 5).map(function (e) {
                const total = e.checklist ? e.checklist.length : 0;
                const done = e.checklist ? e.checklist.filter(function (i) { return i.completed }).length : 0;
                const progress = total > 0 ? Math.round((done / total) * 100) : 0;
                const timeStr = e.time ? ' às ' + e.time : '';
                return `<tr>
                                            <td style="font-weight: 600">${new Date(e.date).toLocaleDateString()}<br><small style="color: var(--text-muted)">${timeStr}</small></td>
                                            <td><strong>${e.title}</strong></td>
                                            <td>${e.clientName}</td>
                                            <td>${ui.renderGauge(progress, 36)}</td>
                                        </tr>`;
            }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        },

        clients: function (clients) {
            return `
                <div style="display: flex; justify-content: space-between; margin-bottom: 2rem">
                    <h3>Seus Clientes</h3>
                    <button class="btn btn-primary" onclick="application.openForm('client')">Novo Cliente</button>
                </div>
                <div class="grid">
                    ${clients.map(function (c) {
                return `
                        <div class="card card-interactive" onclick="application.openClientDetails('${c.id}')">
                            <h4 style="font-family: var(--font-serif); font-size: 1.2rem; margin-bottom: 0.5rem">${c.name}</h4>
                            <p style="color: #666; font-size: 0.9rem">${c.email}</p>
                            <p style="color: #666; font-size: 0.9rem">${c.phone}</p>
                            <div style="margin-top: 1.5rem; display: flex; gap: 0.5rem" onclick="event.stopPropagation()">
                                <button class="btn btn-primary" style="font-size: 0.75rem" onclick="application.openClientDetails('${c.id}')">Ver Ficha</button>
                                <button class="btn" style="font-size: 0.75rem" onclick="application.editClient('${c.id}')">✏️</button>
                                <button class="btn" style="color:#EF4444; border-color:#FEE2E2; font-size: 0.75rem" onclick="application.deleteItem('clients', '${c.id}', 'cliente')">🗑️</button>
                            </div>
                        </div>`;
            }).join('')}
                </div>
            `;
        },

        clientForm: function (c) {
            return `
                <div class="card" style="max-width: 500px; margin: 0 auto">
                    <form onsubmit="application.saveClient(this); return false;">
                        <input type="hidden" name="id" value="${c ? c.id : ''}">
                        <div class="form-group">
                            <label>Nome</label>
                            <input type="text" name="name" value="${c ? c.name : ''}" required>
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" name="email" value="${c ? c.email : ''}" required>
                        </div>
                        <div class="form-group">
                            <label>Telefone</label>
                            <input type="tel" name="phone" value="${c ? c.phone : ''}" required>
                        </div>
                        <div style="margin-top: 2rem">
                            <button type="submit" class="btn btn-primary">Salvar</button>
                            <button type="button" class="btn" onclick="application.navigate('clients')">Cancelar</button>
                        </div>
                    </form>
                </div>
            `;
        },

        clientDetails: function (client, events) {
            return `
                <div style="margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center">
                    <button class="btn" onclick="application.navigate('clients')">← Voltar para Clientes</button>
                    <button class="btn btn-primary" onclick="application.printIndividualReport('client', '${client.id}')">Gerar Relatório PDF</button>
                </div>
                <div class="grid">
                    <div class="card">
                        <h3 style="font-family: var(--font-serif); margin-bottom: 1.5rem">Informações Básicas</h3>
                        <p><strong>Nome:</strong> ${client.name}</p>
                        <p><strong>E-mail:</strong> ${client.email}</p>
                        <p><strong>Telefone:</strong> ${client.phone}</p>
                        <div style="margin-top: 1.5rem">
                            <button class="btn btn-primary" onclick="application.openContractEditor('${client.id}')">Abrir/Editar Contrato</button>
                        </div>
                    </div>
                </div>
                <div style="margin-top: 3rem">
                    <h3 style="font-family: var(--font-serif); margin-bottom: 1.5rem">Histórico de Eventos</h3>
                    ${events.length === 0 ? '<div class="card"><p style="text-align:center; color:#666">Este cliente ainda não tem eventos vinculados.</p></div>' : `
                        <div class="table-responsive">
                            <table class="simple-table">
                                <thead><tr><th>Data/Hora</th><th>Evento</th><th>Progresso</th><th>Status</th></tr></thead>
                                <tbody>
                                    ${events.map(function (e) {
                const total = e.checklist ? e.checklist.length : 0;
                const done = e.checklist ? e.checklist.filter(function (i) { return i.completed }).length : 0;
                const progress = total > 0 ? Math.round((done / total) * 100) : 0;
                const timeStr = e.time ? ' às ' + e.time : '';
                return `<tr>
                                            <td>${new Date(e.date).toLocaleDateString()}${(timeStr)}</td>
                                            <td>${e.title}</td>
                                            <td>${ui.renderGauge(progress, 32)}</td>
                                            <td>${e.status}</td>
                                        </tr>`;
            }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            `;
        },

        events: function (events, clients) {
            const scheduled = events.filter(function (e) { return e.status !== 'Finalizado'; });
            const completed = events.filter(function (e) { return e.status === 'Finalizado'; });

            const renderTable = function (list, showActions, isCompleted) {
                if (list.length === 0) return '<div class="card"><p style="text-align:center; color:#666">Nenhum evento nesta categoria.</p></div>';
                return `
                <div class="table-responsive">
                    <table class="simple-table">
                        <thead><tr><th>Data/Hora</th><th>Evento</th><th>Convidados</th><th>Valor Total</th><th>Ações</th></tr></thead>
                        <tbody>
                            ${list.map(function (e) {
                    const total = e.checklist ? e.checklist.length : 0;
                    const done = e.checklist ? e.checklist.filter(function (i) { return i.completed }).length : 0;
                    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
                    const timeStr = e.time ? ' às ' + e.time : '';
                    const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
                    const totalValueStr = e.totalValue ? currencyFormatter.format(e.totalValue) : currencyFormatter.format(0);

                    return `<tr>
                                    <td>${new Date(e.date).toLocaleDateString()}${timeStr}</td>
                                    <td style="display: flex; align-items: center; gap: 1rem">
                                        ${ui.renderGauge(progress, 42)}
                                        <div>
                                            <strong>${e.title}</strong><br>
                                            <small style="color: var(--text-muted)">${done}/${total} tarefas</small>
                                        </div>
                                    </td>
                                    <td>${e.guestCount || 0}</td>
                                    <td style="font-weight: 600">${totalValueStr}</td>
                                    <td>
                                        <div style="display: flex; gap: 0.25rem">
                                            ${showActions ? `
                                                <button class="btn btn-primary" style="padding: 0.4rem; font-size: 0.7rem; background: var(--accent-success)" onclick="application.finalizeEvent('${e.id}')">Finalizar</button>
                                                <button class="btn" style="padding: 0.4rem; font-size: 0.7rem" onclick="application.openChecklist('${e.id}')">Checklist</button>
                                                <button class="btn" style="padding: 0.4rem; font-size: 0.7rem" onclick="application.editEvent('${e.id}')">🤝 Fornecedores</button>
                                            ` : `
                                                <button class="btn btn-primary" style="padding: 0.4rem; font-size: 0.7rem" onclick="application.printIndividualReport('event', '${e.id}')">🖨️ Imprimir</button>
                                                <button class="btn" style="padding: 0.4rem; font-size: 0.7rem" onclick="application.openChecklist('${e.id}')">Ações/Histórico</button>
                                            `}
                                            <button class="btn" style="padding: 0.4rem; font-size: 0.7rem" onclick="application.editEvent('${e.id}')">✏️</button>
                                        </div>
                                    </td>
                                </tr>`;
                }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            };

            return `
                <div style="display: flex; justify-content: space-between; margin-bottom: 2rem">
                    <h3>Eventos Agendados</h3>
                    <button class="btn btn-primary" onclick="application.openForm('event')">Novo Evento</button>
                </div>
                ${renderTable(scheduled, true, false)}

                <div style="margin-top: 4rem; margin-bottom: 2rem; border-top: 2px solid #ddd; padding-top: 2rem; display: flex; justify-content: space-between; align-items: center">
                    <h3>Eventos Finalizados com Sucesso</h3>
                    <button class="btn" style="font-size: 0.8rem" onclick="application.printReport('completed_events')">Gerar Relatório Geral (Finalizados)</button>
                </div>
                ${renderTable(completed, false, true)}
            `;
        },

        eventForm: function (clients, e) {
            const vendors = storage.get('vendors');
            const selectedVendors = e && e.vendorIds ? e.vendorIds : [];

            return `
                <div class="card" style="max-width: 500px; margin: 0 auto">
                    <form onsubmit="application.saveEvent(this); return false;" id="event-form">
                        <input type="hidden" name="id" value="${e ? e.id : ''}">
                        <input type="hidden" name="status" value="${e ? e.status : 'Agendado'}">
                        <div class="form-group">
                            <label>Título do Evento</label>
                            <input type="text" name="title" value="${e ? e.title : ''}" required placeholder="Ex: Casamento Silva & Santos">
                        </div>
                        <div class="form-group">
                            <label>Cliente</label>
                            <select name="clientId" required>
                                <option value="">Selecione...</option>
                                ${clients.map(function (c) {
                return '<option value="' + c.id + '" ' + (e && e.clientId === c.id ? 'selected' : '') + '>' + c.name + '</option>';
            }).join('')}
                            </select>
                        </div>
                        <div style="display: flex; gap: 1rem">
                            <div class="form-group" style="flex: 1">
                                <label>Data</label>
                                <input type="date" name="date" value="${e ? e.date : ''}" required>
                            </div>
                            <div class="form-group" style="flex: 1">
                                <label>Hora</label>
                                <input type="time" name="time" value="${e ? e.time : ''}" required>
                            </div>
                        </div>

                        <div style="display: flex; gap: 1rem">
                            <div class="form-group" style="flex: 1">
                                <label>Convidados</label>
                                <input type="number" name="guestCount" value="${e ? e.guestCount || 0 : 0}" oninput="application.calculateEventTotal(this.form)" required>
                            </div>
                            <div class="form-group" style="flex: 1">
                                <label>Valor/Convidado (R$)</label>
                                <input type="number" step="0.01" name="valuePerGuest" value="${e ? e.valuePerGuest || 0 : 0}" oninput="application.calculateEventTotal(this.form)" required>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Valor Total do Evento (Calculado)</label>
                            <input type="number" step="0.01" name="totalValue" value="${e ? e.totalValue || 0 : 0}" readonly style="background: #f8f9fa; font-weight: 600">
                        </div>

                        <div class="form-group">
                            <label>Fornecedores Envolvidos (Múltipla Seleção)</label>
                            <select name="vendorIds" multiple style="height: 120px; padding: 0.5rem">
                                ${vendors.map(v => `
                                    <option value="${v.id}" ${selectedVendors.indexOf(v.id) !== -1 ? 'selected' : ''}>
                                        ${v.name} (${v.category})
                                    </option>
                                `).join('')}
                            </select>
                            <small style="color: var(--text-muted); display: block; margin-top: 0.5rem">
                                Mantenha pressionado Ctrl (ou Cmd no Mac) para selecionar vários profissionais.
                            </small>
                        </div>
                        <div style="margin-top: 2rem">
                            <button type="submit" class="btn btn-primary">Salvar Evento</button>
                            <button type="button" class="btn" onclick="application.navigate('events')">Cancelar</button>
                        </div>
                    </form>
                </div>
            `;
        },

        settings: function () {
            const userId = auth.currentUser.id;
            const brandLabel = localStorage.getItem(DB_NAME + '_brand_label_' + userId) || 'Cerimonial';
            const primaryColor = localStorage.getItem(DB_NAME + '_primary_color_' + userId) || '#C5A059';
            return `
                <div class="card" style="max-width: 600px; margin: 0 auto">
                    <form onsubmit="application.saveSettings(this); return false;">
                        <div class="form-group">
                            <label>Nome da Marca / Logotipo</label>
                            <input type="text" name="brandName" value="${brandLabel}" required placeholder="Ex: Maria Eventos">
                        </div>
                        <div class="form-group">
                            <label>Cor Identidade (Principal)</label>
                            <div style="display: flex; gap: 1rem; align-items: center">
                                <input type="color" name="primaryColor" value="${primaryColor}" style="width: 50px; height: 50px; padding: 0; border: none; border-radius: 8px; cursor: pointer">
                                <span style="font-size: 0.875rem; color: var(--text-muted)">Escolha a cor que melhor combina com seu logotipo.</span>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Alterar Logotipo (JPG/PNG)</label>
                            <input type="file" name="logo" accept="image/*">
                            <small style="color: var(--text-muted); display: block; margin-top: 0.5rem">
                                O logotipo aparece na barra lateral e nos relatórios.
                            </small>
                        </div>
                        <div style="margin-top: 2rem">
                            <button type="submit" class="btn btn-primary">Salvar Configurações</button>
                        </div>
                    </form>
                    <div style="margin-top: 3rem; padding-top: 2rem; border-top: 1px solid var(--border-color)">
                        <h3>Dados e Backup</h3>
                        <p style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 1.5rem">
                            Todos os dados são salvos localmente no seu navegador. 
                        </p>
                        <button class="btn" style="color: #EF4444; border-color: #F87171" onclick="if(confirm('CUIDADO: Isso apagará SEUS dados permanentemente. Continuar?')){ 
                            const userId = auth.currentUser.id;
                            localStorage.removeItem(DB_NAME + '_brand_label_' + userId);
                            localStorage.removeItem(DB_NAME + '_primary_color_' + userId);
                            localStorage.removeItem(DB_NAME + '_logo_' + userId);
                            // Limpar dados do usuário no storage
                            ['clients', 'events', 'vendors'].forEach(key => storage.save(key, []));
                            location.reload();
                        }">Limpar Meus Dados</button>
                    </div>
                </div>
            `;
        },

        checklist: function (event) {
            const items = event.checklist || [];
            const photos = event.photos || [];
            return `
                <div style="margin-bottom: 2rem; display: flex; gap: 1rem">
                    <button class="btn" onclick="application.navigate('events')">← Voltar</button>
                    <button class="btn btn-primary" onclick="application.navigate('events')">OK</button>
                </div>
                
                <div class="grid" style="grid-template-columns: 1fr 1fr; align-items: start">
                    <div class="card">
                        <h3 style="margin-bottom: 1.5rem">Checklist de Tarefas</h3>
                        <form onsubmit="application.addChecklistItem('${event.id}', this); return false;" style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem">
                            <input type="text" name="text" placeholder="Nova tarefa..." required style="flex: 1">
                            <button type="submit" class="btn btn-primary">Adicionar</button>
                        </form>
                        <ul style="list-style: none; padding: 0">
                            ${items.length === 0 ? '<p style="text-align: center; color: #64748B">Nenhuma tarefa.</p>' : items.map(function (item) {
                return `
                                    <li style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid #F1F5F9">
                                        <div style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer" onclick="application.toggleChecklistItem('${event.id}', '${item.id}')">
                                            <input type="checkbox" ${item.completed ? 'checked' : ''} style="width: auto">
                                            <span style="${item.completed ? 'text-decoration: line-through; color: #94A3B8' : ''}">${item.text}</span>
                                        </div>
                                        <button class="btn" style="color: #EF4444; border: none; background: none; padding: 0" onclick="application.deleteChecklistItem('${event.id}', '${item.id}')">×</button>
                                    </li>
                                `;
            }).join('')}
                        </ul>
                    </div>


                    </div>
                </div>
            `;
        },

        vendors: function (vendors) {
            return `
                <div style="display: flex; justify-content: space-between; margin-bottom: 2rem">
                    <h3>Fornecedores</h3>
                    <button class="btn btn-primary" onclick="application.openForm('vendor')">Novo Fornecedor</button>
                </div>
                <div class="grid">
                    ${vendors.map(function (v) {
                return `
                        <div class="card">
                            <h4>${v.name}</h4>
                            <p><small>${v.category}</small></p>
                            <p>${v.contact}</p>
                            <div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem">
                                <button class="btn btn-primary" style="width: 100%" onclick="application.openVendorProducts('${v.id}')">🛒 Cadastrar Produtos</button>
                                <div style="display: flex; gap: 0.5rem">
                                    <button class="btn" style="flex: 1" onclick="application.editVendor('${v.id}')">Editar</button>
                                    <button class="btn" style="flex: 1; color:red; border-color:red" onclick="application.deleteItem('vendors', '${v.id}', 'fornecedor')">Excluir</button>
                                </div>
                            </div>
                        </div>`;
            }).join('')}
                </div>
            `;
        },

        vendorProducts: function (v) {
            const products = v.products || [];
            const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
            return `
                <div style="margin-bottom: 2rem">
                    <button class="btn" onclick="application.navigate('vendors')">← Voltar para Fornecedores</button>
                </div>
                
                <div class="grid" style="grid-template-columns: 1fr 2fr; align-items: start">
                    <div class="card">
                        <h3 style="margin-bottom: 1.5rem">Novo Produto/Serviço</h3>
                        <form onsubmit="application.addVendorProduct('${v.id}', this); return false;">
                            <div class="form-group">
                                <label>Nome do Item</label>
                                <input type="text" name="name" placeholder="Ex: Buffet Completo" required>
                            </div>
                            <div style="display: flex; gap: 1rem">
                                <div class="form-group" style="flex: 1">
                                    <label>Quantidade</label>
                                    <input type="number" name="quantity" value="1" step="0.1" oninput="application.calculateProductTotal(this.form)" required>
                                </div>
                                <div class="form-group" style="flex: 1">
                                    <label>Preço Unitário (R$)</label>
                                    <input type="number" step="0.01" name="price" placeholder="0.00" oninput="application.calculateProductTotal(this.form)" required>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Valor Total do Item</label>
                                <input type="number" name="totalProductValue" readonly style="background: #f8f9fa; font-weight: 600" value="0.00">
                            </div>
                            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem">Adicionar ao Catálogo</button>
                        </form>
                    </div>

                    <div class="card">
                        <h3 style="margin-bottom: 1.5rem">Catálogo de Itens</h3>
                        <table class="simple-table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Qtd</th>
                                    <th>Unitário</th>
                                    <th>Total</th>
                                    <th style="width: 50px"></th>
                                </tr>
                            </thead>
                            <tbody>
                                ${products.length === 0 ? '<tr><td colspan="5" style="text-align: center; color: var(--text-muted)">Nenhum produto cadastrado.</td></tr>' : products.map(p => `
                                    <tr>
                                        <td><strong>${p.name}</strong></td>
                                        <td>${p.quantity || 1}</td>
                                        <td>${currencyFormatter.format(p.price)}</td>
                                        <td style="font-weight: 600">${currencyFormatter.format(p.total || p.price)}</td>
                                        <td>
                                            <button onclick="application.deleteVendorProduct('${v.id}', '${p.id}')" 
                                                    style="color: #EF4444; border: none; background: none; cursor: pointer; font-size: 1.2rem">×</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        },

        vendorForm: function (v) {
            return `
                <div class="card" style="max-width: 500px; margin: 0 auto">
                    <form onsubmit="application.saveVendor(this); return false;">
                        <input type="hidden" name="id" value="${v ? v.id : ''}">
                        <div class="form-group">
                            <label>Empresa/Nome</label>
                            <input type="text" name="name" value="${v ? v.name : ''}" required>
                        </div>
                        <div class="form-group">
                            <label>Categoria</label>
                            <input type="text" name="category" value="${v ? v.category : ''}" placeholder="Ex: Buffet, Decoração" required>
                        </div>
                        <div class="form-group">
                            <label>Contato</label>
                            <input type="text" name="contact" value="${v ? v.contact : ''}" required>
                        </div>
                        <div style="margin-top: 2rem">
                            <button type="submit" class="btn btn-primary">Salvar</button>
                            <button type="button" class="btn" onclick="application.navigate('vendors')">Cancelar</button>
                        </div>
                    </form>
                </div>
            `;
        },

        reports: function () {
            return `
                <div class="grid">
                    <div class="card">
                        <h3>Agenda Completa</h3>
                        <p>Imprimir todos os eventos agendados.</p>
                        <button class="btn btn-primary" onclick="application.printReport('events')">Gerar Relatório</button>
                    </div>
                    <div class="card">
                        <h3>Lista de Contatos</h3>
                        <p>Imprimir lista de todos os clientes.</p>
                        <button class="btn btn-primary" onclick="application.printReport('clients')">Gerar Relatório</button>
                    </div>
                </div>
            `;
        },

        eventReport: function (events) {
            return '<h1>Relatório de Agenda</h1><table class="simple-table"><thead><tr><th>Data</th><th>Título</th><th>Cliente</th></tr></thead><tbody>' +
                events.map(function (e) { return '<tr><td>' + (new Date(e.date).toLocaleDateString()) + '</td><td>' + e.title + '</td><td>' + e.clientName + '</td></tr>'; }).join('') +
                '</tbody></table>';
        },

        clientReport: function (clients) {
            return '<h1>Lista de Clientes</h1><table class="simple-table"><thead><tr><th>Nome</th><th>Email</th><th>Telefone</th></tr></thead><tbody>' +
                clients.map(function (c) { return '<tr><td>' + c.name + '</td><td>' + c.email + '</td><td>' + c.phone + '</td></tr>'; }).join('') +
                '</tbody></table>';
        },

        individualClientReport: function (client, events) {
            return `
                ${ui.renderReportHeader('Relatório do Cliente', client.name)}
                <div style="margin-bottom: 3rem">
                    <h3>Dados de Contato</h3>
                    <p><strong>E-mail:</strong> ${client.email}</p>
                    <p><strong>Telefone:</strong> ${client.phone}</p>
                </div>
                <h3>Histórico de Eventos</h3>
                <table class="simple-table">
                    <thead><tr><th>Data/Hora</th><th>Evento</th><th>Status</th></tr></thead>
                    <tbody>
                        ${events.map(function (e) {
                const timeStr = e.time ? ' às ' + e.time : '';
                return `<tr>
                                <td>${new Date(e.date).toLocaleDateString()}${timeStr}</td>
                                <td>${e.title}</td>
                                <td>${e.status}</td>
                            </tr>`;
            }).join('')}
                    </tbody>
                </table>
            `;
        },

        individualEventReport: function (event) {
            const items = event.checklist || [];
            const subtitle = `Evento: ${event.title} | Cliente: ${event.clientName}`;
            const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

            return `
                ${ui.renderReportHeader('Relatório do Evento', subtitle)}
                
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-top: 2rem; padding: 1.5rem; background: #f8f9fa; border-radius: 8px">
                    <div>
                        <small style="color: #64748B; text-transform: uppercase; font-weight: 700; font-size: 0.7rem">Total de Convidados</small>
                        <p style="font-size: 1.25rem; font-weight: 600; margin: 0.25rem 0 0 0">${event.guestCount || 0}</p>
                    </div>
                    <div>
                        <small style="color: #64748B; text-transform: uppercase; font-weight: 700; font-size: 0.7rem">Valor por Convidado</small>
                        <p style="font-size: 1.25rem; font-weight: 600; margin: 0.25rem 0 0 0">${currencyFormatter.format(event.valuePerGuest || 0)}</p>
                    </div>
                    <div>
                        <small style="color: #64748B; text-transform: uppercase; font-weight: 700; font-size: 0.7rem">Investimento Total</small>
                        <p style="font-size: 1.25rem; font-weight: 600; margin: 0.25rem 0 0 0">${currencyFormatter.format(event.totalValue || 0)}</p>
                    </div>
                </div>

                <div style="margin-top: 2rem">
                    <h3>Checklist de Acompanhamento</h3>
                    <table class="simple-table">
                        <thead><tr><th>Tarefa</th><th>Status</th></tr></thead>
                        <tbody>
                            ${items.length === 0 ? '<tr><td colspan="2">Nenhuma tarefa registrada.</td></tr>' : items.map(function (i) {
                return `<tr>
                                    <td>${i.text}</td>
                                    <td>${i.completed ? '✅ Concluído' : '⏳ Pendente'}</td>
                                </tr>`;
            }).join('')}
                        </tbody>
                    </table>
                </div>

                <div style="margin-top: 2rem">
                    <h3>Fornecedores Contratados</h3>
                    <table class="simple-table">
                        <thead><tr><th>Empresa</th><th>Categoria</th><th>Contato</th></tr></thead>
                        <tbody>
                            ${!event.vendorIds || event.vendorIds.length === 0 ? '<tr><td colspan="3">Nenhum fornecedor vinculado.</td></tr>' : event.vendorIds.map(vid => {
                const v = storage.getById('vendors', vid);
                if (!v) return '';
                return `<tr>
                                    <td><strong>${v.name}</strong></td>
                                    <td>${v.category}</td>
                                    <td>${v.contact}</td>
                                </tr>`;
            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        },

        contractEditor: function (client, text) {
            return `
                <div style="margin-bottom: 2rem; display: flex; gap: 1rem">
                    <button class="btn" onclick="application.openClientDetails('${client.id}')">← Cancelar</button>
                    <button class="btn btn-primary" onclick="application.printContract('${client.id}')">🖨️ Imprimir Contrato</button>
                </div>
                <div class="card">
                    <form onsubmit="application.saveContract('${client.id}', this); return false;">
                        <div class="form-group">
                            <label>Termos do Contrato</label>
                            <textarea name="contractText" style="width: 100%; height: 500px; font-family: monospace; line-height: 1.5; padding: 1rem; border: 1px solid #ddd; resize: vertical">${text}</textarea>
                        </div>
                        <div style="margin-top: 2rem">
                            <button type="submit" class="btn btn-primary">Salvar e Sair</button>
                        </div>
                    </form>
                </div>
            `;
        },

        contractReport: function (text) {
            return `
                ${ui.renderReportHeader('Contrato de Prestação de Serviços')}
                <div class="contract-print-view" style="padding: 1cm 0; font-family: serif; white-space: pre-wrap; line-height: 1.6; font-size: 11pt">
                    ${text}
                </div>
            `;
        },


        login: function () {
            return `
                <div style="max-width: 400px; margin: 100px auto; text-align: center">
                    <h1 style="font-family: var(--font-serif); margin-bottom: 2rem">Acesso ao Sistema</h1>
                    <div class="card">
                        <form onsubmit="application.handleLogin(this); return false;">
                            <div class="form-group" style="text-align: left">
                                <label>E-mail</label>
                                <input type="email" name="email" required placeholder="seu@email.com">
                            </div>
                            <div class="form-group" style="text-align: left">
                                <label>Senha</label>
                                <input type="password" name="password" required placeholder="••••••••">
                            </div>
                            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem">Entrar</button>
                        </form>
                        <p style="margin-top: 1.5rem; font-size: 0.875rem; color: var(--text-muted)">
                            Não tem uma conta? <a href="#" onclick="application.navigate('signup')" style="color: var(--primary-color); font-weight: 600">Cadastre-se</a>
                        </p>
                    </div>
                </div>
            `;
        },

        signup: function () {
            return `
                <div style="max-width: 400px; margin: 80px auto; text-align: center">
                    <h1 style="font-family: var(--font-serif); margin-bottom: 2rem">Criar sua Conta</h1>
                    <div class="card">
                        <form onsubmit="application.handleSignup(this); return false;">
                            <div class="form-group" style="text-align: left">
                                <label>Nome Completo</label>
                                <input type="text" name="name" required placeholder="Como deseja ser chamado">
                            </div>
                            <div class="form-group" style="text-align: left">
                                <label>E-mail</label>
                                <input type="email" name="email" required placeholder="seu@email.com">
                            </div>
                            <div class="form-group" style="text-align: left">
                                <label>Senha</label>
                                <input type="password" name="password" required placeholder="••••••••">
                            </div>
                            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem">Criar Conta</button>
                        </form>
                        <p style="margin-top: 1.5rem; font-size: 0.875rem; color: var(--text-muted)">
                            Já tem uma conta? <a href="#" onclick="application.navigate('login')" style="color: var(--primary-color); font-weight: 600">Entrar</a>
                        </p>
                    </div>
                </div>
            `;
        }
    }
};

/** Inicialização **/
window.onload = function () {
    application.init();
};
