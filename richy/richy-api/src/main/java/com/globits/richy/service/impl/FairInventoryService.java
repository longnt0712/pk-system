package com.globits.richy.service.impl;

import com.globits.richy.domain.FairItem;
import com.globits.richy.domain.FairItemOption;
import com.globits.richy.dto.FairItemRow;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import javax.persistence.EntityManager;
import javax.persistence.LockModeType;
import javax.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@Transactional
public class FairInventoryService {
    private static final String CATEGORY = "CATEGORY";
    private static final String DIFFICULTY = "DIFFICULTY";
    private final FairService fairs;
    @PersistenceContext private EntityManager em;

    public FairInventoryService(FairService fairs) {
        this.fairs = fairs;
    }

    @Transactional(readOnly = true)
    public List<FairItemRow> items(Long eventId) {
        managedEvent(eventId);
        return em.createQuery("select new com.globits.richy.dto.FairItemRow(i.id, i.name, i.unitPrice, i.quantity, "
                + "i.categoryId, i.difficultyId, case when i.photo is null then false else true end, i.revision) "
                + "from FairItem i where i.eventId=:event order by i.id", FairItemRow.class)
                .setParameter("event", eventId).getResultList();
    }

    @Transactional(readOnly = true)
    public byte[] photo(Long eventId, Long itemId) {
        managedEvent(eventId);
        List<byte[]> photos = em.createQuery("select i.photo from FairItem i where i.eventId=:event and i.id=:id", byte[].class)
                .setParameter("event", eventId).setParameter("id", itemId).getResultList();
        if (photos.isEmpty() || photos.get(0) == null) {
            throw new FairService.Missing("Không tìm thấy ảnh mặt hàng.");
        }
        return photos.get(0);
    }

    public FairItemRow saveItem(Long eventId, Long id, Long revision, String name, long unitPrice,
            int quantity, Long categoryId, Long difficultyId, boolean removePhoto, MultipartFile file) {
        managedEvent(eventId);
        String title = FairService.text(name, 150, "Tên mặt hàng cần từ 1 đến 150 ký tự.");
        if (unitPrice < 0 || unitPrice > 1000000000L || quantity < 0 || quantity > 1000000) {
            throw new FairService.Invalid("Nhập đơn giá nguyên từ 0 đến 1.000.000.000 đ và số lượng nguyên từ 0 đến 1.000.000.");
        }
        FairItem item = id == null ? new FairItem() : item(eventId, id, revision);
        byte[] newPhoto = file == null ? null : FairItemPhoto.encode(file);
        option(categoryId, CATEGORY, LockModeType.PESSIMISTIC_WRITE);
        option(difficultyId, DIFFICULTY, LockModeType.PESSIMISTIC_WRITE);
        item.categoryId = categoryId;
        item.difficultyId = difficultyId;
        item.eventId = eventId;
        item.name = title;
        item.unitPrice = unitPrice;
        item.quantity = quantity;
        if (newPhoto != null || removePhoto) { item.photo = newPhoto; }
        if (id == null) { em.persist(item); }
        em.flush();
        return new FairItemRow(item.id, item.name, item.unitPrice, item.quantity, categoryId, difficultyId,
                item.photo != null, item.revision);
    }

    public void deleteItem(Long eventId, Long id, Long revision) {
        managedEvent(eventId);
        em.remove(item(eventId, id, revision));
        em.flush();
    }

    @Transactional(readOnly = true)
    public List<FairItemOption> options() {
        FairService.requireInventoryManager();
        return em.createQuery("from FairItemOption order by id", FairItemOption.class).getResultList();
    }

    public FairItemOption saveOption(Long id, String kind, String name) {
        FairService.requireInventoryManager();
        validateKind(kind);
        String title = Normalizer.normalize(FairService.text(name, 80, "Tên danh mục cần từ 1 đến 80 ký tự."), Normalizer.Form.NFC);
        String key = FairService.text(title.toLowerCase(Locale.ROOT), 80, "Tên danh mục cần từ 1 đến 80 ký tự.");
        FairItemOption value = id == null ? new FairItemOption() : option(id, kind, LockModeType.PESSIMISTIC_WRITE);
        List<Long> matches = em.createQuery("select o.id from FairItemOption o where o.kind=:kind and o.nameKey=:key", Long.class)
                .setParameter("kind", kind).setParameter("key", key).setMaxResults(1).getResultList();
        if (!matches.isEmpty() && !Objects.equals(matches.get(0), id)) {
            throw new FairService.Invalid("Tên danh mục này đã tồn tại.");
        }
        value.kind = kind;
        value.name = title;
        value.nameKey = key;
        if (id == null) { em.persist(value); }
        em.flush();
        return value;
    }

    public void deleteOption(Long id, String kind) {
        FairService.requireInventoryManager();
        validateKind(kind);
        FairItemOption value = option(id, kind, LockModeType.PESSIMISTIC_WRITE);
        String field = CATEGORY.equals(kind) ? "categoryId" : "difficultyId";
        boolean used = !em.createQuery("select i.id from FairItem i where i." + field + "=:id", Long.class)
                .setParameter("id", id).setMaxResults(1).getResultList().isEmpty();
        if (used) {
            throw new FairService.Invalid("Danh mục đang được sử dụng. Hãy chuyển các mặt hàng sang danh mục khác trước.");
        }
        em.remove(value);
        em.flush();
    }

    private void managedEvent(Long eventId) {
        FairService.requireInventoryManager();
        fairs.event(eventId);
    }

    private FairItem item(Long eventId, Long id, Long revision) {
        List<FairItem> rows = em.createQuery("from FairItem i where i.id=:id and i.eventId=:event", FairItem.class)
                .setParameter("id", id).setParameter("event", eventId).setMaxResults(1).getResultList();
        if (rows.isEmpty()) { throw new FairService.Missing("Không tìm thấy mặt hàng trong hội chợ này."); }
        FairItem item = rows.get(0);
        if (!Objects.equals(revision, item.revision)) { throw new Conflict(); }
        return item;
    }

    private FairItemOption option(Long id, String kind, LockModeType lock) {
        FairItemOption value = id == null ? null : em.find(FairItemOption.class, id, lock);
        if (value == null || !kind.equals(value.kind)) {
            throw new FairService.Invalid("Danh mục không hợp lệ hoặc đã bị xóa.");
        }
        return value;
    }

    private static void validateKind(String kind) {
        if (!CATEGORY.equals(kind) && !DIFFICULTY.equals(kind)) {
            throw new FairService.Invalid("Chọn thể loại hoặc mức độ.");
        }
    }

    public static class Conflict extends RuntimeException {}
}
