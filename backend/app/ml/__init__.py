"""Machine-learning package (encoders + scoring).

`text.build_document` and everything in `scoring` are pure python and safe to
import anywhere, including the API. `registry` and `text.encode` need torch,
which only the worker image installs — see the note in `registry.py`.
"""
