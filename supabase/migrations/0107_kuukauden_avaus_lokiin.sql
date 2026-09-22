-- 0107 — Kuukauden avaaminen näkyy lokissa
--
-- Sulkeminen kirjattiin toimintalokiin, avaaminen ei. Lukon purkaminen
-- on kirjanpidon kannalta merkittävämpi teko kuin sen laittaminen: sen
-- jälkeen suljetun kuukauden kuitteja voi taas muuttaa. Ilman merkintää
-- lokista ei näe kuka avasi eikä milloin.
--
-- Merkintä on kriittinen, kuten sulkukin, joten se erottuu lokin
-- suodattimissa.

create or replace function public.reopen_month(p_restaurant uuid, p_month text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  if not is_owner(p_restaurant) then
    raise exception 'Vain omistaja voi avata kuukauden';
  end if;

  if p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Kuukauden muoto on VVVV-KK';
  end if;

  delete from closed_months
  where restaurant_id = p_restaurant
    and month = (p_month || '-01')::date;

  get diagnostics v_deleted = row_count;

  -- Vain oikeasta avauksesta merkintä: sulkematonta ei ole avattu.
  if v_deleted > 0 then
    perform write_audit(
      p_restaurant,
      'month.reopened',
      'month',
      null,
      to_char((p_month || '-01')::date, 'MM/YYYY'),
      'Kirjanpidon kuukausi avattiin uudelleen: '
        || to_char((p_month || '-01')::date, 'MM/YYYY'),
      null,
      null,
      true
    );
  end if;
end;
$$;

revoke all on function public.reopen_month(uuid, text) from public;
grant execute on function public.reopen_month(uuid, text) to authenticated;
