# Bower

[![Build Status](https://travis-ci.org/bower/bower.svg?branch=master)](https://travis-ci.org/bower/bower) [![Windows Build](https://ci.appveyor.com/api/projects/status/jr6vfra8w84plh2g/branch/master?svg=true)](https://ci.appveyor.com/project/sheerun/bower/history) [![Coverage Status](https://img.shields.io/coveralls/bower/bower.svg)](https://coveralls.io/r/bower/bower?branch=master) 

<img align="right" height="300" src="http://bower.io/img/bower-logo.png">

> Um gerenciador de pacotes para a web

Bower oferece uma solução não opinativa ao problema de **gerenciamento de pacotes front-end**, enquanto expoem o modelo de dependência do pacote através de uma API que pode ser usada por mais do que "opinionated build stack". Não há sistema de dependências amplas, as dependências não são partilhadas entre diferentes applicativos, e a estrutura da dependência é plana.

Bower é executado dentro do Git, e é um pacote agnóstico. O componente de um pacote pode ser feito até qualquer tipo de recurso, e usado em qualquer tipo de transporte. (ex., AMD, CommonJS, etc.).

**Veja a documentação completa em [bower.io](http://bower.io)**

[Veja todos os pacotes disponíveis através do registro Bower](http://bower.io/search/).

## Instalação

Bower é um utilitário de linha de comandos. Instale-o com [npm](http://npmjs.org/).

```sh
$ npm install -g bower
```

Bower depende de [Node.js](http://nodejs.org/) e [npm](http://npmjs.org/). Certefique-se também que tem o [git](http://git-scm.com/) está instalado pois alguns pacotes presentes no Bower precisam que este esteja instalado.


## Uso

Veja um referência completa  da linha de comando em [bower.io/docs/api/](http://bower.io/docs/api/)

### Instalação de pacotes e dependências

```sh
# Instala as dependências presentes no bower.json
$ bower install

# Instala um pacote e adiciona-o ao bower.json
$ bower install <package> --save

# Instala uma versão especifica de um pacote e adiciona-o ao bower.json
$ bower install <package>#<version> --save
```

O pacote pode ser um atalho do GitHub, um endpoint do Git, um URL, e mais. Lei-a mais sobre [bower install](http://bower.io/docs/api/#install)

```sh
# Pacote registado
$ bower install jquery

# Atalho do GitHub
$ bower install desandro/masonry

# Endpoint do Git
$ bower install git://github.com/user/package.git

# URL
$ bower install http://example.com/script.js
```

Salve os seus pacotes no [bower.json com o bower init](http://bower.io/docs/creating-packages/#bowerjson).

### Uso de pacotes

Nós desencorajamos o uso de componentes Bower estáticos por razões de performance e segurança (se o componente tem um arquivo `upload.php` que não é ignorado, este pode ser facilmente explorado para más intenções).

A melhor abordagem para processar componentes instalados pelo Bower é usando a ferramenta de construção (como [Grunt] (http://gruntjs.com/) ou [gulp] (http://gulpjs.com/)), e servi-los associados ou usando carregador de módulo (como [RequireJS] (http://requirejs.org/)).

### Desinstalar pacotes

Para desinstalar um pacote instalado localmente:

```sh
$ bower uninstall <package-name>
```

### prezto and oh-my-zsh users

No `prezto` ou `oh-my-zsh`, não se esqueça de fazer `alias bower='noglob bower'` ou `bower install jquery\#1.9.1`

### Executar comandos com sudo

Bowqer é um comando de usuário, não é preciso executá-lo com a permissão de um super usúario (Administrador.).
No entanto, se você ainda deseja executar comandos com sudo, use a opção `--allow-root`.

### Usuários de Windows

Para usar Bower no Windows, você deve instalar
[msysgit](http://msysgit.github.io/) corretamente. Certefique-se que tem as opções abaixo marcadas:

![msysgit](http://f.cl.ly/items/2V2O3i1p3R2F1r2v0a12/mysgit.png)

Note que, se você usa TortoiseGit e o Bower estiver a pedir a sua password SSH, você deve adicionar a seguinte variável de ambiente: `GIT_SSH -
C:\Program Files\TortoiseGit\bin\TortoisePlink.exe`. Modifique a diretória de `TortoisePlink`
se precisar.

## Configuração

Bower pode ser configurado usando JSON no arquivo `.bowerrc`. Leia todas as opções válidas em [bower.io/docs/config](http://bower.io/docs/config).

## Completion (experimental)

_NOTA_: Ainda não está finalizado para a implementação da versão 1.0.0

Bower tem um comando experimental `completion` que se baseia, e funciona de forma similar ao [npm completion](https://npmjs.org/doc/cli/completion.html). Não está disponível para usuários Windows.

Este comando irá dar resultado a um script Bash / ZSH para colocar dentro do arquivo `~/.bashrc`, `~/.bash_profile`, ou `~/.zshrc`.

```sh
$ bower completion >> ~/.bash_profile
```


## Suporte

* [StackOverflow](http://stackoverflow.com/questions/tagged/bower)
* [Mailinglist](http://groups.google.com/group/twitter-bower) - twitter-bower@googlegroups.com
* [\#bower](http://webchat.freenode.net/?channels=bower) em Freenode


## Contribuições

Acolhemos todas as contribuições de todo o tipo de alguém. Por favor, dedique um momento para
rever as diretrizes para [contribuição](CONTRIBUTING.md).

* [Report de Bugs](CONTRIBUTING.md#bugs)
* [Requesito de Recurso/Feature Requests](CONTRIBUTING.md#features)
* [Requesito de Puxar/Pull Requests](CONTRIBUTING.md#pull-requests)


Note que no Windows, para efetuar testes, você precisa de configurar o Git antes de clonar:

```
git config --global core.autocrlf input
```

## Equipa Bower

Bower é composto por muitas pessoas em todo o mundo, contribuindo muito ou pouco. O nosso obrigado a todos os que fazem parte dela.

### Equipa Core

* [@satazor](https://github.com/satazor)
* [@wibblymat](https://github.com/wibblymat)
* [@paulirish](https://github.com/paulirish)
* [@benschwarz](https://github.com/benschwarz)
* [@svnlto](https://github.com/svnlto)
* [@sheerun](https://github.com/sheerun)

### Bower Alumni

* [@fat](https://github.com/fat)
* [@maccman](https://github.com/maccman)


## Licença

Copyright (c) 2015 Twitter and other contributors

Licensed under the MIT License
