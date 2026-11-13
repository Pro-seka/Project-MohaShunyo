import asyncio,time
from playwright.async_api import async_playwright
import os
URL='file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','index.html'))
DONKI=[{"flrID":"m%d"%i,"classType":"M2.1","peakTime":"2026-11-01T01:10Z","beginTime":"2026-11-01T01:00Z","activeRegionNum":4500,"link":"u"} for i in range(8)]+[{"flrID":"a","classType":"X1.5","peakTime":"2026-11-05T05:10Z","beginTime":"2026-11-05T05:00Z","activeRegionNum":4510,"link":"u"}]
POWER={"properties":{"parameter":{"ALLSKY_SFC_SW_DWN":{"20261101":5.0,"20261102":6.0,"20261103":-999}}}}
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    errs=[]
    pg=await b.new_page(viewport={'width':640,'height':420}); pg.set_default_timeout(45000)
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.route('**/api.nasa.gov/DONKI/FLR*',lambda r:r.fulfill(json=DONKI,headers={'access-control-allow-origin':'*'}))
    await pg.route('**/api.nasa.gov/DONKI/SEP*',lambda r:r.fulfill(json=[{"sepID":1}],headers={'access-control-allow-origin':'*'}))
    await pg.route('**/power.larc.nasa.gov/**',lambda r:r.fulfill(json=POWER,headers={'access-control-allow-origin':'*'}))
    await pg.route('**/images-assets.nasa.gov/**',lambda r:r.abort())
    await pg.goto(URL+'?demo=1'); await pg.wait_for_timeout(1200)
    print('LIVE brief:',(await pg.inner_text('#brief')).replace('\n',' | ')[:300],flush=True)
    await pg.click('#wd button[data-v=moon]'); await pg.wait_for_timeout(200)
    print('MOON brief:',(await pg.inner_text('#brief')).replace('\n',' | ')[:260],flush=True)
    await pg.click('#wd button[data-v=mars]')
    await pg.click('#sw button[data-v=storm2024]'); await pg.wait_for_timeout(100)
    print('SCENARIO brief:',(await pg.inner_text('#brief')).replace('\n',' | ')[:200],flush=True)
    assert await pg.is_enabled('#sw button[data-v=dust2018]')
    await pg.click('#wd button[data-v=moon]'); assert not await pg.is_enabled('#sw button[data-v=dust2018]'); await pg.click('#wd button[data-v=mars]')
    print('dock buttons:',await pg.evaluate("document.querySelectorAll('#dock .ab').length"),flush=True)
    print('go',flush=True); await pg.click('#go'); await pg.wait_for_timeout(500); print('launched',flush=True); await pg.click('#scx'); print('welcome closed',flush=True)
    await pg.keyboard.press('Shift+KeyX'); await pg.wait_for_timeout(200)
    await pg.click('#scx')
    await pg.keyboard.press('Digit7')           # shelter during warning window (hotkey 7)
    for i in range(6): await pg.keyboard.press('KeyN'); await pg.wait_for_timeout(60)
    if await pg.is_visible('#sci'): await pg.click('#scx')
    t=time.time()
    FF="for(let k=0;k<8;k++)window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyN',bubbles:true}))"   # fast-forward 8 hours
    for i in range(60):
      if await pg.is_visible('#sci'): await pg.click('#scx')
      if await pg.is_visible('#end'): break
      await pg.evaluate(FF); await pg.wait_for_timeout(30)
      if time.time()-t>400: break
    print('loops',i,'hud',await pg.inner_text('#hr'),'banner',await pg.inner_text('#ban'),flush=True)
    print('END visible:',await pg.is_visible('#end'),flush=True)
    if await pg.is_visible('#end'):
      print((await pg.inner_text('#end')).replace('\n',' | ')[:1100],flush=True)
      await pg.screenshot(path='tests/_out_live_end.png')
    print('ERRORS',errs)
    await b.close()
asyncio.run(main())
