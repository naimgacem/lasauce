"""Admin console services, one module per area of the console.

Every mutating method writes its `admin_actions` row in the same transaction as
the change it describes. Reads are unredacted by design — see `serializers`.
"""
