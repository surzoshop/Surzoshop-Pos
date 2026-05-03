
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_in_shop(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_can_access_shop(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_stock() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_installment_payment() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_stock_on_purchase() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_stock_adjustment() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, public, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_in_shop(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_shop(uuid, uuid) TO authenticated;
