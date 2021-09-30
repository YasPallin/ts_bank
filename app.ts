import express from 'express';
import session from 'express-session';
import mysql from 'mysql';
import passport from 'passport';
import { Strategy } from 'passport-local'
import bcrypt from 'bcrypt';
import path from 'path';
import { Response } from 'express-serve-static-core';
const __dirname = path.resolve();
declare var next: any;

const app = express();
const port = 3000;
const con = mysql.createConnection({
    host: "localhost",
    user: "user",
    password: "user",
    database: "soulbanco"
});

// interface da tranferência
interface TransacaoProps {
    username: string;

    valor: number;
    banco: string;
    agencia: string;
    conta: string;
    digito: string;
    tipo: string;
};

// classe da transferência
class Transferencia implements TransacaoProps {
    username!: string;

    valor!: number;
    banco!: string;
    agencia!: string;
    conta!: string;
    digito!: string;
    tipo!: string;
    // onde constrói o objeto
    constructor(username: string, valor: number, banco: string, agencia: string, conta: string, digito: string, tipo: string) {
        this.username = username;
        this.valor = valor;
        this.banco = banco;
        this.agencia = agencia;
        this.conta = conta;
        this.digito = digito;
        this.tipo = tipo;
    }
    // método de transferir da conta para outra
    transferirDinheiro(req: any, res: any) {
        let conta = req.session.passport.user.username

        var sql_transferencia = `INSERT INTO transacao (cliente_conta, data_transacao, valor_transacao, banco_transacao, agencia_transacao, conta_transacao, digito_transacao, tipo_transacao) VALUES ('${this.username}', CURDATE(), ${this.valor}, '${this.banco}', '${this.agencia}', '${this.conta}', '${this.digito}', '${this.tipo}')`;
        var sql_edita_saldo = `UPDATE conta SET saldo_cliente = saldo_cliente - ${this.valor} WHERE conta_cliente = '${this.username}'`;
        

        query(sql_transferencia, function (err: any, result: any) {
            if (err) throw err;
            query(sql_edita_saldo, function (err: any, result: any) {
                if (err) throw err;

                res.redirect("/extrato");
            });
        });
    };
};


// callback params (err, response)
function query(query: any, callback: any) {
    con.query(query, function (err, result) {
        if (err) {
            callback(err, null);
        }
        console.log(result);
        callback(null, result);
    });
};


//Middleware
app.set('view engine', "ejs");
app.use(express.static(__dirname + '/public'));
app.use(session({
    secret: "verygoodsecret",
    resave: false,
    saveUninitialized: true
}));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

//Passport.js
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function (user, done) {
    done(null, user);
});

passport.deserializeUser(function (user: any, done) {
    let username = user.username;
    //setup user model
    query(`SELECT * FROM login_cliente WHERE login_cliente.username = '${username}'`, function (err: any, userlist: any) {
        let user = userlist[0];
        done(err, user);
    });
});

passport.use(new Strategy(function (username, password, done) {
    query(`SELECT * FROM login_cliente WHERE login_cliente.username = '${username}'`, function (err: any, userlist: any) {
        if (err) {
            return done(err);
        }
        if (!userlist || userlist.length == 0) {
            return done(null, false, { message: 'Incorrect username.' });
        }

        let user = userlist[0];
        let pass = userlist[0].password;

        bcrypt.compare(password, pass, function (err, res) {
            if (err) {
                return done(err);
            }
            if (res === false) {
                return done(null, false, { message: 'Incorrect password.' });
            }
            else {
                return done(null, user);
            }
        });
    });
}));

function isLoggedIn(req: any, res: any, next: any) {
    if (req.isAuthenticated()) {
        res.locals.user = req.session.passport.user;
    }
    else {
        if (req.path != '/login') {
            return res.redirect('/login')
        }
    }
    return next();
}




//Routes
app.get('/', (req: any, res: any) => {
    if (req.isAuthenticated()) {
        res.locals.user = req.session.passport.user;
    }
    const response = {
        title: 'Home',
    }
    res.render('pages/index', response);
});

app.get('/register', isLoggedIn, (req, res) => {
    res.render('pages/register', { title: 'Register', error: false });
});

//Setup  user
app.post('/register', isLoggedIn, async (req, res) => {


    let user = req.body.username;
    let pass = req.body.password


    query(`SELECT * FROM login_cliente where username = '${user}'`, (err: any, response: any) => {
        if (err) {
            return res.status(500).send("Erro ao consultar!")
        }
        if (response && response.length >= 1) {
            res.redirect('/login');
            return;
        }

        bcrypt.genSalt(10, function (err, salt) {
            if (err) {
                return next(err);
            }
            bcrypt.hash(pass, salt, function (err, hash) {
                if (err) {
                    return next(err);
                }

                query(`INSERT INTO login_cliente
                (username, password)
                VALUES
                ('${user}','${hash}')`, (req: any, res: any) => {
                    if (err) {
                        return res.status(500).send("Erro ao cadastrar usuário!")
                    }
                });
                res.redirect('/login')
            });
        });

    })

});
// rota cadastro
app.get('/cadastro', (req, res) => {
    const response = {
        title: 'Cadastro',
        error: req.query.error
    }
    res.render('pages/formCadastro', response)
})

app.post('/cadastro', (req, res) => {
    let nome_cliente = req.body.nome_cliente;
    let endereco_cliente = req.body.endereco_cliente;
    let cpf_cliente = req.body.cpf_cliente;

    var sql = `INSERT INTO clientes(nome_cliente, endereco_cliente, cpf_cliente) VALUES ('${nome_cliente}','${endereco_cliente}','${cpf_cliente}')`;

    query(sql, function (err: any, result: any) {
        const resultado = result;
        console.log(resultado);
        if (err) throw err;
        console.log("dado inserido: " + sql);
    });

    var sql = `SELECT id_cliente FROM clientes WHERE cpf_cliente =('${cpf_cliente}')`;
    var id_cliente = query(sql, function (err: any, conteudo: any[]) {
        if (err)
            return res.status(500).send("Erro ao consultar");

        const response = {
            title: 'Cadastro Conta',
            error: req.query.error,
            descricao_item: conteudo[0]
        }

        return res.render('pages/criarConta', response);
    });

})

//cadastro conta
app.get('/cadastroConta', (req, res) => {
    const response = {
        title: 'Cadastro Conta',
        error: req.query.error
    }
    res.render('pages/criarConta', response)
})

app.post('/cadastroConta', (req, res) => {
    let agencia_cliente = req.body.agencia_cliente;
    let username = req.body.username;
    let cliente_id = req.body.id_cliente;

    var sql = `INSERT INTO conta(agencia_cliente, conta_cliente, saldo_cliente, cliente_id) VALUES ('${agencia_cliente}','${username}', 5000.00, ${cliente_id})`;

    query(sql, function (err: any, result: any) {
        const resultado = result;
        console.log(resultado);
        if (err) {
            return res.redirect('/error');
        }


        console.log("dado inserido: " + sql);

        let user = req.body.username;
        let pass = req.body.password;
        query(`SELECT * FROM login_cliente where username = '${user}'`, (err: any, response: any) => {
            if (err) {
                return res.status(500).send("Erro ao consultar!")
            }
            if (response && response.length >= 1) {
                res.redirect('/login');
                return;
            }

            bcrypt.genSalt(10, function (err, salt) {
                if (err) {
                    return next(err);
                }
                bcrypt.hash(pass, salt, function (err, hash) {
                    if (err) {
                        return next(err);
                    }

                    query(`INSERT INTO login_cliente
                    (username, password)
                    VALUES
                    ('${user}','${hash}')`, (req: any, res: any) => {
                        if (err) {
                            return res.status(500).send("Erro ao cadastrar usuário!")
                        }
                    });
                    res.redirect('/login')
                });
            });

        })
    });


})

//error
app.get('/error', (req, res) => {
    const response = {
        title: 'Error',
        error: req.query.error
    }
    res.render('pages/error', response)
})



// rota para listar transações no extrato
app.get("/extrato", isLoggedIn, (req: any, res: any) => {
    let conta = req.session.passport.user.username
    console.log('Conta:'+ conta)
    let listar_transferencias = `SELECT * FROM transacao WHERE cliente_conta = '${conta}'`;
    let info_conta = `SELECT * FROM conta where conta_cliente = '${conta}'`;
    // let listar_transferencias = `SELECT *, saldo_cliente FROM transacao JOIN conta ON cliente_conta = conta_cliente WHERE cliente_conta = '${conta}'`;
    query(listar_transferencias, function (err: any, result: any[]) {
        if (err) throw err;

        query(info_conta, function (err: any, icResult: any[]) {
            if (err) throw err;

            const response = {
                title: 'Extrato',
                error: req.query.error,
                transferenciasLista: result,
                infoConta: icResult
            }
            
            res.render("pages/extrato", response)
        });
    });
});



//transferencia
app.get("/transferencia", isLoggedIn, (req, res) => {

    const response = {
        title: 'Transferência',
        error: false
    }
    res.render("pages/formTransferencia", response);

});

app.post("/transferencia", isLoggedIn, (req, res) => {
    let transacao = new Transferencia(req.body.username, req.body.valor_transf, req.body.banco_transf, req.body.agencia_transf, req.body.conta_transf, req.body.digito_transf, req.body.tipo_conta_transf);
    transacao.transferirDinheiro(req, res);
});



app.get('/login', isLoggedIn, (req, res) => {
    const response = {
        title: 'Login',
        error: req.query.error
    }
    res.render('pages/login', response)
});

app.post('/login', passport.authenticate('local', {
    successRedirect: '/extrato',
    failureRedirect: '/login?error=true'
}))

app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});



app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});


