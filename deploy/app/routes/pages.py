"""Page routes: portal + SPA shells."""

from flask import Blueprint, render_template, send_from_directory
import os

bp = Blueprint("pages", __name__)

CALC_STATIC = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "calc")


@bp.route("/")
def portal():
    from flask import redirect
    return redirect("/calculatie/")


@bp.route("/calculatie/")
@bp.route("/calculatie/<path:path>")
def calculatie(path=None):
    return send_from_directory(CALC_STATIC, "index.html")
