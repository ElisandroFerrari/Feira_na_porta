# Feira na Porta

Aplicação multipágina para a feira: apresentação e autenticação em `index.html`, gestão restrita do catálogo em `admin.html` e catálogo/carrinho do cliente em `client.html`. A proprietária também pode abrir o catálogo pela área administrativa para visualizar a loja. A interface usa HTML, Tailwind via CDN e JavaScript ES modules, com Supabase Auth, Database e Storage.

As áreas do cliente e administrativa têm alternância de tema claro/escuro; a escolha fica salva no navegador e também é aplicada à página de perfil. O botão de compartilhamento do catálogo envia para a página pública de cadastro. A página inicial inclui metadados Open Graph/Twitter com URLs absolutas e uma imagem PNG de 1200 × 630 para as prévias nas redes sociais; atualize o domínio canônico e as URLs das imagens em `index.html` se hospedar o projeto em outro endereço.

Os layouts adaptam o grid do catálogo, cabeçalhos, formulários e tabelas a telas pequenas e grandes. A preferência por movimento reduzido é respeitada, e as tabelas administrativas mantêm rolagem horizontal própria em telas estreitas.

## Configuração do Supabase

1. Execute [`supabase/schema.sql`](./supabase/schema.sql) no SQL Editor do projeto. O script cria os perfis e o perfil automático de novos usuários, migra os preços e unidades existentes para a tabela relacionada `precos_produto`, cria os campos de perfil e o histórico de pedidos, atualiza o telefone de contato administrativo de teste se ainda estiver cadastrado, configura o bucket público de imagens e restringe operações de escrita a administradores. Execute a versão atualizada do script para habilitar os novos recursos.
2. Cadastre a proprietária em `index.html` ou em **Authentication → Users**. No SQL Editor, promova somente a conta dela ao papel administrativo, substituindo o e-mail no comando:

   ```sql
   update public.profiles
   set role = 'admin'
   where user_id = (select id from auth.users where email = 'proprietaria@exemplo.com');
   ```

   Execute mudanças de papel somente pelo SQL Editor com uma conta administrativa do projeto. O frontend não tem privilégio para atualizar `profiles.role`, e o trigger do banco rejeita alterações de papel feitas por usuários que não sejam administradores. Todo cadastro público recebe o papel `customer`; o usuário não pode conceder a si mesmo acesso de administrador.
3. A Project URL e a chave pública publishable estão em [`js/supabase.js`](./js/supabase.js). Atualize-as ao usar outro projeto. A chave pública pode estar no navegador; nunca use a chave `service_role` no frontend.
4. Se a confirmação de e-mail estiver habilitada em Supabase Auth, o novo cliente deve confirmar o endereço antes de entrar.
5. Sirva a pasta por HTTP local ou hospede-a em um serviço de páginas estáticas. As importações ES modules não funcionam corretamente ao abrir `index.html` diretamente por `file://`.

### Problemas no cadastro

Se o cadastro mostrar que o banco não conseguiu salvar o novo usuário, o trigger que cria o perfil pode estar ausente ou desatualizado. No SQL Editor do Supabase, execute este bloco para reaplicar somente essa configuração (sem rodar as migrações do catálogo):

```sql
create or replace function public.create_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'customer')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute procedure public.create_customer_profile();
```

Confirme também que `public.profiles` tem as colunas `user_id`, `full_name` e `role`, e que `role` permite o valor `customer`. Se o erro continuar, consulte os logs de Auth e Database no painel do Supabase para ver a causa reportada pelo trigger.

O navegador também verifica sessão e papel antes de exibir as páginas privadas. As políticas RLS são a proteção efetiva dos dados: somente `admin` pode inserir, editar ou excluir produtos e imagens, mesmo que alguém tente chamar o Supabase diretamente.

Na tela do cliente, a imagem `assets/qrcodepix.jpeg` é exibida como QR Code Pix. Antes de habilitar pedidos por Pix, configure também o código Pix Copia e Cola correspondente em `PIX_COPY_PASTE` de `js/client.js`; o checkout bloqueia o Pix enquanto esse código estiver vazio.

## Catálogo e pedidos

A tabela `produtos` guarda os dados gerais do produto; cada opção de venda fica em `precos_produto`, relacionada por `produto_id` e contendo `unidade`, `preco` e `ordem`. Assim, um produto pode oferecer, por exemplo, `Caixa 20kg` e `Kg`. O painel permite cadastrar várias opções, e o cliente escolhe qual delas adicionar ao carrinho. A proprietária pode cadastrar uma URL de imagem ou enviar um arquivo de até 5 MB; os arquivos ficam no bucket `product-images`.

Clientes podem editar nome, telefone e endereço em `profile.html`. A proprietária também pode gerenciar seu nome, telefone de contato público, endereço, e-mail e senha na aba **Meu perfil** do painel. O telefone administrativo salvo no perfil alimenta o botão de WhatsApp da página inicial e o destino dos pedidos; informe o número com DDD e, se necessário, código do país. E-mail e senha são alterados pelo Supabase Auth; a troca de e-mail pode exigir confirmação. O checkout usa o telefone e o endereço salvos no perfil do cliente, sem campos separados no carrinho; use **Editar meu perfil** antes de finalizar para atualizar esses dados. Ao finalizar, o pedido é validado e gravado em `public.orders` antes de abrir o WhatsApp. No histórico de vendas, a proprietária pode marcar cada pedido como **Concluído** ou **Cancelado**; pedidos novos ficam **Pendentes** até uma dessas ações. A atualização do schema converte antigos pedidos “Entregues” em concluídos, preserva cancelados e converte os demais status intermediários em pendentes. A lista de clientes usa uma função protegida no banco para acessar os e-mails de Auth; RLS restringe pedidos e perfis às contas autorizadas.

Pedidos feitos antes da instalação dessa atualização, que só foram enviados pelo WhatsApp, não aparecem retroativamente no histórico. O preço e a disponibilidade dos pedidos são confirmados no atendimento.

## Desenvolvimento

Para iniciar um servidor local:

```sh
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000`.
