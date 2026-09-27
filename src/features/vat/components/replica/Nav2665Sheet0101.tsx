import React from 'react';
import { Nav2665TableRow } from './Nav2665TableRow';

interface Nav2665Sheet0101Props {
  getVal: (row: string, col: 'base' | 'tax') => number;
}

/**
 * 2665A-01-01 lap: Fizetendő általános forgalmi adó (01 - 36. sorok).
 */
export function Nav2665Sheet0101({ getVal }: Nav2665Sheet0101Props) {
  return (
    <div className="border border-black bg-white select-text">
      {/* Subheader */}
      <div className="bg-neutral-100 border-b border-black px-3 py-1 flex justify-between items-center text-[10px] font-bold">
        <span className="uppercase text-neutral-800">Fizetendő általános forgalmi adó</span>
        <span className="text-neutral-500 font-normal italic">
          Az adatokat ezer forintban kell feltüntetni!
        </span>
      </div>

      {/* Main Table */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-neutral-100 text-[9px] font-bold text-neutral-800 text-center uppercase tracking-tight">
            <th className="w-8 sm:w-9 border-r border-b-2 border-black p-1 print:py-0.5"></th>
            <th className="border-r border-b-2 border-black p-1 font-sans print:py-0.5">a</th>
            <th className="w-28 sm:w-36 border-r border-b-2 border-black p-1 print:py-0.5">
              <div>Az adó alapja</div>
              <div className="text-[8px] font-normal text-neutral-500 italic lowercase print:text-[7.5px]">
                (tényleges vagy helyesbített)
              </div>
            </th>
            <th className="w-28 sm:w-36 border-r border-b-2 border-black p-1 print:py-0.5">
              <div>Az adó összege</div>
              <div className="text-[8px] font-normal text-neutral-500 italic lowercase print:text-[7.5px]">
                (tényleges vagy helyesbített)
              </div>
            </th>
            <th className="w-8 sm:w-9 border-b-2 border-black p-1 print:py-0.5"></th>
          </tr>
        </thead>
        <tbody>
          <Nav2665TableRow
            rowNum="01"
            title="Közösség területén kívülre történő termékértékesítés, azzal egy tekintet alá eső szolgáltatásnyújtás, valamint nemzetközi közlekedéshez kapcsolódó termékértékesítés és szolgáltatásnyújtás"
            baseVal={getVal('01', 'base')}
            hasTax={false}
          />
          <Nav2665TableRow
            rowNum="02"
            title="Közösségen belülre történő, adólevonási joggal járó adómentes termékértékesítés (kivéve az új közlekedési eszköz értékesítését)"
            baseVal={getVal('02', 'base')}
            hasTax={false}
          />
          <Nav2665TableRow
            rowNum="03"
            title="Új közlekedési eszköz Közösségen belülre történő értékesítésének összege"
            baseVal={getVal('03', 'base')}
            hasTax={false}
          />
          <Nav2665TableRow
            rowNum="04"
            title="Az Áfa tv. 142. §-a szerinti termékértékesítés, szolgáltatásnyújtás és az adólevonással járó adómentes belföldi értékesítés ellenértéke"
            baseVal={getVal('04', 'base')}
            hasTax={false}
          />
          <Nav2665TableRow
            rowNum="110"
            title="0 %-os kulcs alá tartozó értékesítés"
            baseVal={getVal('110', 'base')}
            hasTax={false}
          />
          <Nav2665TableRow
            rowNum="05"
            title="5 %-os kulcs alá tartozó értékesítés"
            baseVal={getVal('05', 'base')}
            taxVal={getVal('05', 'tax')}
          />
          <Nav2665TableRow
            rowNum="06"
            title="18 %-os kulcs alá tartozó értékesítés"
            baseVal={getVal('06', 'base')}
            taxVal={getVal('06', 'tax')}
          />
          <Nav2665TableRow
            rowNum="07"
            title="27 %-os kulcs alá tartozó értékesítés"
            baseVal={getVal('07', 'base')}
            taxVal={getVal('07', 'tax')}
          />
          <Nav2665TableRow
            rowNum="08"
            title="Közérdekű vagy egyéb speciális jellegére tekintettel adómentes értékesítés"
            baseVal={getVal('08', 'base')}
            hasTax={false}
          />
          <Nav2665TableRow
            rowNum="09"
            title="Különleges eljárással megállapított adó"
            baseVal={getVal('09', 'base')}
            taxVal={getVal('09', 'tax')}
          />
          <Nav2665TableRow
            rowNum="10"
            title="Saját vállalkozáson belül végzett beruházás után fizetendő adó"
            baseVal={getVal('10', 'base')}
            taxVal={getVal('10', 'tax')}
          />
          <Nav2665TableRow
            rowNum="11"
            title="Közösségen belülről történő adómentes termékbeszerzés"
            baseVal={getVal('11', 'base')}
            hasTax={false}
          />
          <Nav2665TableRow
            rowNum="112"
            title="Közösségen belülről történő 0 %-os kulcs alá tartozó termékbeszerzés"
            baseVal={getVal('112', 'base')}
            hasTax={false}
          />
          <Nav2665TableRow
            rowNum="12"
            title="Közösségen belülről történő 5 %-os kulcs alá tartozó termékbeszerzés"
            baseVal={getVal('12', 'base')}
            taxVal={getVal('12', 'tax')}
          />
          <Nav2665TableRow
            rowNum="13"
            title="Közösségen belülről történő 18 %-os kulcs alá tartozó termékbeszerzés"
            baseVal={getVal('13', 'base')}
            taxVal={getVal('13', 'tax')}
          />
          <Nav2665TableRow
            rowNum="14"
            title="Közösségen belülről történő 27 %-os kulcs alá tartozó termékbeszerzés"
            baseVal={getVal('14', 'base')}
            taxVal={getVal('14', 'tax')}
          />
          <Nav2665TableRow
            rowNum="15"
            title="Közösségen belülről történő új közlekedési eszköz beszerzés (27 %-os adómérték)"
            baseVal={getVal('15', 'base')}
            taxVal={getVal('15', 'tax')}
          />
          <Nav2665TableRow
            rowNum="16"
            title="Közösségen belülről történő jövedéki termékbeszerzés (27 %-os adómérték)"
            baseVal={getVal('16', 'base')}
            taxVal={getVal('16', 'tax')}
          />
          <Nav2665TableRow
            rowNum="17"
            title="Adómentes szolgáltatás igénybevétele (közösségi adóalanytól és harmadik országbeli adóalanytól)"
            baseVal={getVal('17', 'base')}
            hasTax={false}
          />
          <Nav2665TableRow
            rowNum="18"
            title="Közösségi adóalanytól igénybe vett szolgáltatás utáni adófizetési kötelezettség az Áfa tv. 37. § (1) bekezdése alapján (27 %-os adómérték)"
            baseVal={getVal('18', 'base')}
            taxVal={getVal('18', 'tax')}
          />
          <Nav2665TableRow
            rowNum="19"
            title="Közösségi adóalanytól igénybe vett szolgáltatás utáni egyéb adófizetési kötelezettség"
            baseVal={getVal('19', 'base')}
            taxVal={getVal('19', 'tax')}
          />
          <Nav2665TableRow
            rowNum="23"
            title="Adómentes termékimport"
            baseVal={getVal('23', 'base')}
            hasTax={false}
          />
          <Nav2665TableRow
            rowNum="26"
            title="Termékimport címén fizetendő 27 %-os mértékű adó"
            baseVal={getVal('26', 'base')}
            taxVal={getVal('26', 'tax')}
          />
          <Nav2665TableRow
            rowNum="27"
            title="Harmadik országbeli adóalanytól igénybevett szolgáltatás utáni adófizetési kötelezettség"
            baseVal={getVal('27', 'base')}
            taxVal={getVal('27', 'tax')}
          />
          <Nav2665TableRow
            rowNum="28"
            title="Az Áfa tv. 32. §, 34. § szerinti termékbeszerzés (27 %-os adómérték)"
            baseVal={getVal('28', 'base')}
            taxVal={getVal('28', 'tax')}
          />
          <Nav2665TableRow
            rowNum="29"
            title="Az Áfa tv. 142. §-a alapján a fordított adózás szabályai szerint fizetendő adó"
            baseVal={getVal('29', 'base')}
            taxVal={getVal('29', 'tax')}
            className="bg-purple-50/30"
          />
          <Nav2665TableRow
            rowNum="35"
            title="Egyéb"
            baseVal={getVal('35', 'base')}
            taxVal={getVal('35', 'tax')}
          />
          <Nav2665TableRow
            rowNum="36"
            title="Összesen (01-35. sorok, 110. és 112-114. sorok)"
            baseVal={getVal('36', 'base')}
            taxVal={getVal('36', 'tax')}
            isSummary={true}
            className="border-t-2 border-neutral-900 bg-neutral-100"
          />
        </tbody>
      </table>
    </div>
  );
}
