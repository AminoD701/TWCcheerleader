from pathlib import Path

path = Path('tools/fetch_auto_news.py')
text = path.read_text(encoding='utf-8')
original = text

text = text.replace(
    'NAME_QUERY_BATCH_SIZE = 8\nMAX_NAME_QUERY_BATCHES = 24\n',
    'NAME_QUERY_BATCH_SIZE = 8\nMAX_NAME_QUERY_BATCHES = 24\nTEAM_QUERY_BATCH_SIZE = 6\nMAX_TEAM_QUERY_BATCHES = 8\n',
    1,
)

text = text.replace(
    'def build_queries(girl_names: list[str]) -> list[str]:\n    girl_names = [name for name in girl_names if usable_girl_name(name)]\n    queries = list(BASE_QUERIES)',
    'def build_queries(girl_names: list[str], site_teams: list[str]) -> list[str]:\n    girl_names = [name for name in girl_names if usable_girl_name(name)]\n    site_teams = [team.strip() for team in site_teams if team and team.strip()]\n    queries = list(BASE_QUERIES)',
    1,
)

needle = '''        names_expr = " OR ".join(f'"{name}"' for name in batch)\n        queries.append(f"({names_expr}) 啦啦隊")\n    return queries\n'''
replacement = '''        names_expr = " OR ".join(f'"{name}"' for name in batch)\n        queries.append(f"({names_expr}) 啦啦隊")\n\n    # Also search the teams actually represented by the site's roster. This catches\n    # cheerleader/team stories whose headline names the squad or club but omits a girl name.\n    for start in range(0, min(len(site_teams), TEAM_QUERY_BATCH_SIZE * MAX_TEAM_QUERY_BATCHES), TEAM_QUERY_BATCH_SIZE):\n        batch = site_teams[start:start + TEAM_QUERY_BATCH_SIZE]\n        if not batch:\n            break\n        teams_expr = " OR ".join(f'"{team}"' for team in batch)\n        queries.append(f"({teams_expr}) 啦啦隊")\n    return queries\n'''
text = text.replace(needle, replacement, 1)
text = text.replace('for query in build_queries(girl_names):', 'for query in build_queries(girl_names, site_teams):', 1)

if text == original:
    raise SystemExit('team-query patch made no changes')

path.write_text(text, encoding='utf-8')
print('Roster team query patch applied.')
