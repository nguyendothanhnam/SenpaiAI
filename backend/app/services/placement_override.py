"""Manual setup is distinct from assessment evidence and grants no exercise score."""
def manual_placement_level(user):
    override = getattr(user, 'placement_override', None)
    if isinstance(override, dict) and override.get('active') and override.get('level') in ('N5', 'N4', 'N3', 'N2', 'N1'):
        return override['level']
    return None
