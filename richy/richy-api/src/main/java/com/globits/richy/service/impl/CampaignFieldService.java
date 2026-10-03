package com.globits.richy.service.impl;

import java.time.*;
import java.text.Normalizer;
import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.annotation.Secured;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.globits.richy.domain.*;
import com.globits.richy.dto.*;
import com.globits.richy.repository.*;

@Service
@Transactional(readOnly=true)
public class CampaignFieldService {
    private Clock clock=Clock.system(ZoneId.of("Asia/Ho_Chi_Minh"));
    @Autowired private CampaignRepository campaigns;
    @Autowired private CampaignFieldRepository field;
    @Autowired private CampaignFlowerEntryRepository entries;
    private static final Set<String> PALETTE=new HashSet<>(Arrays.asList("#F48FB1","#EF5350","#FFB74D","#FFE082","#B39DDB","#81D4FA","#80CBC4"));

    public CampaignFieldDto students(Long id, Long classId, String search, String cursor, int size) {
        return read(id,classId,search,cursor,size,false,false,false);
    }
    @Secured({"ROLE_ADMIN","ROLE_EDUCATION_MANAGERMENT","ROLE_STUDENT_MANAGERMENT"})
    public CampaignFieldDto managed(Long id, Long classId, String search, String cursor, int size) {
        return read(id,classId,search,cursor,size,true,false,false);
    }
    @Secured({"ROLE_ADMIN"})
    public CampaignFieldDto exportGardens(Long id, Long classId, String cursor, int size) {
        if (classId == null || classId < 0) { throw invalid(); }
        return read(id,classId == 0 ? null : classId,"",cursor,size,true,classId == 0,true);
    }
    public List<CampaignFieldDto.ClassOption> classes(Long id) {
        campaign(id);
        List<CampaignFieldDto.ClassOption> result=new ArrayList<>();
        for(Object[] row:field.classes()) {
            CampaignFieldDto.ClassOption option=new CampaignFieldDto.ClassOption(); option.id=number(row[0]); option.name=clean(row[1]); result.add(option);
        }
        result.sort(Comparator.comparing(o->o.name)); return result;
    }
    private Campaign campaign(Long id) {
        Campaign value=id==null || id<1 ? null : campaigns.findOne(id);
        if(value==null){throw new CampaignService.CampaignNotFoundException();}
        String name=Normalizer.normalize(clean(value.getName()),Normalizer.Form.NFD).replaceAll("\\p{M}","").toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+"," ").trim();
        if(!name.equals("cung me em yeu men chua") || !"2026-10-01".equals(value.getStartDate()) || !"2026-10-31".equals(value.getEndDate())) {
            throw new CampaignService.InvalidCampaignException("Chiến dịch này chưa có cánh đồng hoa Mân Côi.");
        }
        return value;
    }
    private CampaignFieldDto read(Long id,Long classId,String search,String cursor,int size,boolean managers,boolean unassigned,boolean byId) {
        Campaign campaign=campaign(id); String text=search==null ? "" : search.trim();
        if(size<1 || size>12 || text.length()>100 || (classId!=null && classId<1)) { throw invalid(); }
        if(classId!=null && classes(id).stream().noneMatch(c->c.id.equals(classId))) { throw invalid(); }
        Long afterCount=null,afterId=null;
        if(cursor!=null && !cursor.isEmpty()) {
            if(!cursor.matches("[0-9]{1,10}:[1-9][0-9]{0,18}")){throw invalid();}
            try {String[] parts=cursor.split(":"); afterCount=Long.valueOf(parts[0]); afterId=Long.valueOf(parts[1]);} catch(NumberFormatException error){throw invalid();}
        }
        List<String> keys=new ArrayList<>();
        for(int i=0;i<campaign.getFlowerItems().size();i++){keys.add(CampaignDto.itemKey(campaign,campaign.getFlowerItems().get(i),i));}
        CampaignFieldDto dto=new CampaignFieldDto(); dto.campaign=new CampaignDto(campaign,true); dto.serverTime=System.currentTimeMillis();
        if(keys.isEmpty()){return dto;}
        String end=LocalDate.now(clock).toString();
        if(end.compareTo(campaign.getEndDate())>0){end=campaign.getEndDate();}
        List<Object[]> rows=field.page(id,keys,campaign.getStartDate(),end,classId,text,afterCount,afterId,size+1,managers,unassigned,byId);
        dto.hasMore=rows.size()>size;
        Map<Long,CampaignFieldDto.Garden> owners=new LinkedHashMap<>();
        for(Object[] row:rows.subList(0,Math.min(size,rows.size()))) {
            CampaignFieldDto.Garden garden=new CampaignFieldDto.Garden(); garden.id=number(row[0]); garden.saintName=clean(row[1]);
            garden.fullName=(clean(row[2])+" "+clean(row[3])).trim(); if(garden.fullName.isEmpty()){garden.fullName=clean(row[4]);}
            if(garden.fullName.isEmpty()){garden.fullName="Vườn hoa chưa có tên";}
            garden.completedCount=number(row[5]); owners.put(garden.id,garden); dto.gardens.add(garden);
        }
        if(owners.isEmpty()){return dto;}
        List<Long> ids=new ArrayList<>(owners.keySet());
        for(Object[] row:field.participantClasses(ids)) {
            CampaignFieldDto.Garden garden=owners.get(number(row[0])); String name=clean(row[2]);
            if(garden!=null && !name.isEmpty() && !garden.classes.contains(name)){garden.classes.add(name);}
        }
        for(CampaignFieldDto.Garden garden:dto.gardens){Collections.sort(garden.classes);}
        List<CampaignFlowerEntry> values=entries.findByCampaignIdAndStudentIdInAndDateBetween(id,ids,campaign.getStartDate(),end);
        Map<String,Integer> credits=new HashMap<>(); Set<String> validKeys=new HashSet<>(keys);
        for(CampaignFlowerEntry entry:values) {
            if(validKeys.contains(entry.getItemKey()) && entry.isCompleted()) {
                String day=entry.getStudentId()+":"+entry.getDate(); credits.put(day,credits.getOrDefault(day,0)+1);
            }
        }
        values.sort(Comparator.comparing(CampaignFlowerEntry::getDate).thenComparing(e->!e.isCompleted()).thenComparing(CampaignFlowerEntry::getItemKey));
        for(CampaignFlowerEntry entry:values) {
            String day=entry.getStudentId()+":"+entry.getDate(); int remaining=credits.getOrDefault(day,0);
            if(!owners.containsKey(entry.getStudentId()) || !validKeys.contains(entry.getItemKey()) || !PALETTE.contains(entry.getPaintColor()) || remaining<1){continue;}
            CampaignFieldDto.Color color=new CampaignFieldDto.Color(); color.date=entry.getDate(); color.itemKey=entry.getItemKey(); color.paintColor=entry.getPaintColor();
            owners.get(entry.getStudentId()).colors.add(color); credits.put(day,remaining-1);
        }
        if(dto.hasMore) {CampaignFieldDto.Garden last=dto.gardens.get(dto.gardens.size()-1); dto.nextCursor=last.completedCount+":"+last.id;}
        return dto;
    }
    private static CampaignService.InvalidCampaignException invalid(){return new CampaignService.InvalidCampaignException("Bộ lọc cánh đồng hoa không hợp lệ.");}
    private static String clean(Object value){return value==null ? "" : value.toString().trim();}
    private static long number(Object value){return ((Number)value).longValue();}
}
