-- Garante que venda/parcela so apontem para registros da MESMA proprietaria (alem do RLS)
alter table public.clients add constraint clients_id_user_key unique (id, user_id);
alter table public.sales add constraint sales_id_user_key unique (id, user_id);
alter table public.sales add constraint sales_client_owner_fk
  foreign key (client_id, user_id) references public.clients (id, user_id) on delete restrict;
alter table public.installments add constraint installments_sale_owner_fk
  foreign key (sale_id, user_id) references public.sales (id, user_id) on delete restrict;
