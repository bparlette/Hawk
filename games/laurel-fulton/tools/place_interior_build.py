#!/usr/bin/env python3
"""place_interior_build.py — task L12/L13: the PUBLIC-BUILDING interior layouts of the kit (siblings of tools/interior_build.py's
split-foyer house). Two new layout types, both ONE long floor you walk left -> right from the front door, side cutaway:
  python3 tools/interior_build.py weis store              -> data/interiors/weis.json      (big-box grocery)
  python3 tools/interior_build.py gringada restaurant     -> data/interiors/gringada.json  (Mexican restaurant — MEMORY BUILD)
(interior_build.py hands any place type here.) Unlike the crew houses these are NOT listed in data/interiors/index.json (that list
is "whose house you start in"); a place's kit id lives in data/places.json and anyone can GO IN at its door.

THE KIT adds to the house kit's vocabulary:
  props   store:  cart, register (a checkout lane), sec_desk (security), shelf (a gondola aisle end: sign + product colours),
                  soda (the soda end cap — the bottle Brian opened), dairy (wall cooler), produce, deli, pizza (the pizza counter + ovens), door_back
          restaurant: counter, hot_case (the food display case — what gets stolen), grill (hood + flat-top), prep, booth, table (+ chairs), menu,
                  sombrero, salsa
  npcs    who works/hangs out here: {id, name, role, floor, x, face, look, barks[]} — drawn on the side-view person sheet; the engine
          (src/lf_places.js) drops an npc if YOU are that person.  beats  scripted scenes the engine knows by id.
  spots   as the house kit (EXIT) + GRAB SLICE (pizza), OPEN SODA (the soda aisle, Rigg only), ORDER (the counter), STEAL FOOD (hot_case, Jimmy only)
Coordinates: metres, x runs front door -> back wall, z up from the floor."""

def store(pid):
    W = 46.0
    P = [{'kind': 'cart', 'x': 2.3}, {'kind': 'sec_desk', 'x': 4.2},
         {'kind': 'register', 'x': 7.0, 'lane': 1}, {'kind': 'register', 'x': 9.5, 'lane': 2}, {'kind': 'register', 'x': 12.0, 'lane': 3},
         {'kind': 'produce', 'x': 15.2}, {'kind': 'produce', 'x': 17.8},
         {'kind': 'shelf', 'x': 21.0, 'sign': 'AISLE 5 · CEREAL', 'cols': ['#d94a3a', '#e8c23a', '#3a7ad9', '#e87a2a']},
         {'kind': 'shelf', 'x': 24.0, 'sign': 'AISLE 6 · SNACKS', 'cols': ['#e8c23a', '#c42b2b', '#2f8f5a', '#7a3a9a']},
         {'kind': 'soda', 'x': 27.2, 'sign': 'AISLE 7 · SODA', 'cols': ['#c42b2b', '#2f6fb0', '#2f8f5a', '#e8a21a']},
         {'kind': 'shelf', 'x': 30.4, 'sign': 'AISLE 8 · CANNED', 'cols': ['#c8a23a', '#c42b2b', '#5a9a3a', '#e8e0c0']},
         {'kind': 'dairy', 'x': 34.0},
         {'kind': 'deli', 'x': 37.6}, {'kind': 'pizza', 'x': 41.4}, {'kind': 'door_back', 'x': 45.0}]
    rooms = [{'floor': 'main', 'x0': 0.0, 'x1': 13.4, 'name': 'front end', 'wall': '#ece6d6', 'floorc': '#cdc6b4'},
             {'floor': 'main', 'x0': 13.4, 'x1': 19.4, 'name': 'produce', 'wall': '#e4ecd4', 'floorc': '#c7c6a8'},
             {'floor': 'main', 'x0': 19.4, 'x1': 35.4, 'name': 'grocery aisles', 'wall': '#eee8d8', 'floorc': '#cdc6b4'},
             {'floor': 'main', 'x0': 35.4, 'x1': W, 'name': 'pizza & deli', 'wall': '#f0dcc0', 'floorc': '#b98c64'}]
    npcs = [{'id': 'jason', 'name': 'Jason', 'role': 'SECURITY', 'floor': 'main', 'x': 5.2, 'face': -1, 'look': 'guard',
             'barks': ['Cart return is by the door.', 'Keep it moving.', 'Nobody walks out with a rotisserie chicken on my watch.']},
            {'id': 'brad', 'name': 'Brad', 'role': 'PIZZA', 'floor': 'main', 'x': 42.3, 'face': -1, 'look': 'apron',
             'barks': ['Pie is up.', 'Large pepperoni, ten minutes.', 'Extra cheese. Always extra cheese.']},
            {'id': 'rigg', 'name': 'Rigg', 'role': 'STOCK', 'floor': 'main', 'x': 28.4, 'face': -1, 'look': 'rigg',
             'barks': ['Stocking soda. Just stocking soda.']},
            {'id': 'scott', 'name': 'Scott', 'role': 'MANAGER', 'floor': 'main', 'x': 46.6, 'face': -1, 'look': 'manager', 'hidden': True, 'barks': []}]
    spots = [{'act': 'EXIT', 'floor': 'main', 'x': 0.9}, {'act': 'GRAB SLICE', 'floor': 'main', 'x': 40.2, 'src': 'pizza'},
             {'act': 'OPEN SODA', 'floor': 'main', 'x': 27.2, 'src': 'soda', 'only': 'rigg'}]
    return {'id': pid, 'type': 'store', 'width': W, 'grade': 0.0, 'ceiling': 4.6,
            'floors': [{'id': 'main', 'z': 0.0, 'x0': 0.0, 'x1': W}], 'links': [], 'door': {'floor': 'main', 'x': 0.9},
            'rooms': rooms, 'props': [dict(p, floor='main') for p in P], 'spots': spots, 'npcs': npcs, 'beats': ['fired'],
            'sign': {'text': 'WEIS', 'sub': 'WHISKEY BOTTOM'}, 'dogs': 0, 'cpuIdle': {'floor': 'main', 'x': 20.0}}

def restaurant(pid):
    W = 24.0
    P = [{'kind': 'sombrero', 'x': 2.4}, {'kind': 'booth', 'x': 3.2}, {'kind': 'table', 'x': 6.4}, {'kind': 'table', 'x': 9.0},
         {'kind': 'plant', 'x': 10.9}, {'kind': 'menu', 'x': 13.2}, {'kind': 'counter', 'x': 13.2}, {'kind': 'hot_case', 'x': 15.0}, {'kind': 'salsa', 'x': 11.8},
         {'kind': 'grill', 'x': 19.0}, {'kind': 'prep', 'x': 21.8}]
    rooms = [{'floor': 'main', 'x0': 0.0, 'x1': 10.6, 'name': 'dining room', 'wall': '#e7c690', 'floorc': '#b0502f'},
             {'floor': 'main', 'x0': 10.6, 'x1': 16.4, 'name': 'counter', 'wall': '#4f8f6a', 'floorc': '#c9b08a'},
             {'floor': 'main', 'x0': 16.4, 'x1': W, 'name': 'kitchen', 'wall': '#dcdad0', 'floorc': '#a8a89c'}]
    npcs = [{'id': 'brad', 'name': 'Brad', 'role': 'COOK', 'floor': 'main', 'x': 17.6, 'face': 1, 'look': 'apron',
             'barks': ['Welcome to Gringada.', 'Order up!', 'Two tacos, extra salsa.']},
            {'id': 'jimmy', 'name': 'Jimmy', 'role': '', 'floor': 'main', 'x': -4, 'face': 1, 'look': 'jimmy', 'hidden': True, 'barks': []},
            {'id': 'clayton', 'name': 'Clayton', 'role': '', 'floor': 'main', 'x': -5, 'face': 1, 'look': 'clayton', 'hidden': True, 'barks': []},
            {'id': 'zack', 'name': 'Zack', 'role': '', 'floor': 'main', 'x': -6, 'face': 1, 'look': 'zack', 'hidden': True, 'barks': []}]
    spots = [{'act': 'EXIT', 'floor': 'main', 'x': 0.9}, {'act': 'ORDER', 'floor': 'main', 'x': 12.4, 'src': 'counter'},
             {'act': 'STEAL FOOD', 'floor': 'main', 'x': 15.0, 'src': 'hot_case', 'only': 'jimmy'}]
    return {'id': pid, 'type': 'restaurant', 'width': W, 'grade': 0.0, 'ceiling': 3.6,
            'floors': [{'id': 'main', 'z': 0.0, 'x0': 0.0, 'x1': W}], 'links': [], 'door': {'floor': 'main', 'x': 0.9},
            'rooms': rooms, 'props': [dict(p, floor='main') for p in P], 'spots': spots, 'npcs': npcs, 'beats': ['steal'],
            'sign': {'text': 'GRINGADA', 'sub': 'MEXICAN RESTAURANT'}, 'memory': {'year': 1998, 'label': 'MEMORY BUILD · 1998 · from the owner\'s memory'},
            'dogs': 0, 'cpuIdle': {'floor': 'main', 'x': 8.0}}

TYPES = {'store': store, 'restaurant': restaurant}
